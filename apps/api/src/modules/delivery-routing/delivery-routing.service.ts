import { Injectable, NotFoundException } from "@nestjs/common";
import { DeliveryStopStatus, OrderStatus } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import { GeocodingService } from "../checkout/geocoding.service";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

@Injectable()
export class DeliveryRoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
  ) {}

  async listWindows(companyId: string) {
    return this.prisma.deliveryWindow.findMany({ where: { companyId }, orderBy: { startTime: "asc" } });
  }

  async createWindow(companyId: string, data: { name: string; startTime: string; endTime: string }) {
    return this.prisma.deliveryWindow.create({ data: { companyId, ...data } });
  }

  async listRoutes(companyId: string, date?: string) {
    return this.prisma.deliveryRoute.findMany({
      where: {
        companyId,
        ...(date ? { date: new Date(date) } : {}),
      },
      include: { window: true, stops: { include: { order: true } } },
      orderBy: { date: "desc" },
    });
  }

  private async resolveDepot(companyId: string) {
    const settings = await this.prisma.companySettings.findFirst({ where: { companyId } });
    if (!settings) {
      throw new NotFoundException("Company settings not found");
    }
    return { lat: settings.depotLat, lng: settings.depotLng };
  }

  private async ordersForDate(companyId: string, date: string, windowId?: string) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);

    return this.prisma.order.findMany({
      where: {
        companyId,
        shippingMode: "DELIVERY",
        shippingProvider: "OWN",
        status: { in: [OrderStatus.PAID, OrderStatus.PACKED] },
        createdAt: { gte: start, lt: end },
        ...(windowId ? { deliveryWindowId: windowId } : {}),
      },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });
  }

  private async groupByZone(companyId: string, orders: Array<any>, depot: { lat: number; lng: number }) {
    const zones = await this.prisma.shippingZone.findMany({
      where: { companyId },
      orderBy: { maxDistanceKm: "asc" },
    });

    const grouped = new Map<string, Array<any>>();
    for (const order of orders) {
      const address = `${order.addressLine1} ${order.city ?? ""} ${order.state ?? ""} ${order.postalCode ?? ""} ${order.country ?? ""}`;
      const point = await this.geocoding.geocode(address);
      const distance = haversineKm(depot, point);
      const zone = zones.find((z) => distance <= z.maxDistanceKm) ?? zones[zones.length - 1];
      const zoneId = zone?.id ?? "default";
      const list = grouped.get(zoneId) ?? [];
      list.push({ order, point, distance, zoneId });
      grouped.set(zoneId, list);
    }

    return grouped;
  }

  private sequenceStops(points: Array<{ order: any; point: { lat: number; lng: number }; distance: number }>, depot: { lat: number; lng: number }) {
    const remaining = [...points];
    const ordered: typeof remaining = [];
    let current = depot;

    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const dist = haversineKm(current, candidate.point);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestIndex = i;
        }
      }
      const [next] = remaining.splice(bestIndex, 1);
      ordered.push({ ...next, distance: bestDistance });
      current = next.point;
    }

    return ordered;
  }

  async generateRoute(companyId: string, data: { date: string; windowId?: string; driverName?: string }) {
    const depot = await this.resolveDepot(companyId);
    const orders = await this.ordersForDate(companyId, data.date, data.windowId);
    if (orders.length === 0) {
      return { ok: false, message: "No orders to route" };
    }

    const grouped = await this.groupByZone(companyId, orders, depot);

    const route = await this.prisma.deliveryRoute.create({
      data: {
        companyId,
        date: new Date(data.date),
        windowId: data.windowId ?? null,
        driverName: data.driverName ?? null,
        status: "PLANNED",
      },
    });

    const stops: Array<{ orderId: string; sequence: number; distanceKm: number; etaMinutes: number }> = [];
    let seq = 1;
    for (const zonePoints of grouped.values()) {
      const ordered = this.sequenceStops(zonePoints, depot);
      for (const item of ordered) {
        const etaMinutes = Math.max(10, Math.round(item.distance * 4));
        stops.push({
          orderId: item.order.id,
          sequence: seq,
          distanceKm: Number(item.distance.toFixed(2)),
          etaMinutes,
        });
        seq += 1;
      }
    }

    await this.prisma.deliveryStop.createMany({
      data: stops.map((stop) => ({
        routeId: route.id,
        orderId: stop.orderId,
        sequence: stop.sequence,
        distanceKm: stop.distanceKm,
        etaMinutes: stop.etaMinutes,
      })),
    });

    return this.prisma.deliveryRoute.findUnique({
      where: { id: route.id },
      include: { stops: { include: { order: true }, orderBy: { sequence: "asc" } }, window: true },
    });
  }

  async updateStopStatus(companyId: string, stopId: string, status: DeliveryStopStatus) {
    const stop = await this.prisma.deliveryStop.findFirst({
      where: { id: stopId, route: { companyId } },
      include: { order: true, route: true },
    });
    if (!stop) {
      throw new NotFoundException("Stop not found");
    }

    const updated = await this.prisma.deliveryStop.update({
      where: { id: stopId },
      data: { status },
    });

    await this.prisma.orderStatusEvent.create({
      data: {
        orderId: stop.orderId,
        status: status === "DELIVERED" ? OrderStatus.DELIVERED : stop.order.status,
        message: `Delivery stop updated to ${status}`,
      },
    });

    await this.prisma.emailEventLog.create({
      data: {
        companyId,
        provider: "internal",
        type: "delivery_stop_status",
        recipient: stop.order.customerEmail ?? undefined,
        payload: {
          orderId: stop.orderId,
          status,
        },
      },
    });

    return updated;
  }
}
