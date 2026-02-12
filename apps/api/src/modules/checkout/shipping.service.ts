import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GeocodingService } from "./geocoding.service";
import { AndreaniDevelopersAdapter } from "./adapters/andreani.adapter";
import type { QuoteRequestDto } from "./dto/checkout.dto";
import { LicensingService } from "../licensing/licensing.service";
import { PremiumFeatures } from "../licensing/license.types";
import { SecretsService } from "../secrets/secrets.service";
import { SandboxService } from "../sandbox/sandbox.service";

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
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
    private readonly licensing: LicensingService,
    private readonly secrets: SecretsService,
    private readonly sandbox: SandboxService,
  ) {}

  private async buildAndreani(companyId: string) {
    const secret = await this.secrets.getSecret(companyId, "ANDREANI");
    return new AndreaniDevelopersAdapter({
      loginUrl: process.env.ANDREANI_LOGIN_URL ?? "https://apis.andreani.com/login",
      cotizadorUrl:
        process.env.ANDREANI_COTIZADOR_URL ??
        "https://apis.andreanigloballpack.com/cotizador-globallpack/api/v1/Cotizador",
      preenvioUrl:
        process.env.ANDREANI_PREENVIO_URL ??
        "https://apis.andreanigloballpack.com/altapreenvio-globallpack/api/v1/ordenes-de-envio",
      trackingUrl:
        process.env.ANDREANI_TRACKING_URL ??
        "https://apis.andreanigloballpack.com/trazabilidad-globallpack/api/v1/Envios",
      username: secret?.username ?? process.env.ANDREANI_USER ?? "",
      password: secret?.password ?? process.env.ANDREANI_PASSWORD ?? "",
      originPostal: process.env.ANDREANI_ORIGIN_POSTAL ?? "C1000",
      originCity: process.env.ANDREANI_ORIGIN_CITY ?? "CABA",
      originCountry: process.env.ANDREANI_ORIGIN_COUNTRY ?? "AR",
      contract: secret?.contract ?? process.env.ANDREANI_CONTRACT,
      client: secret?.client ?? process.env.ANDREANI_CLIENT,
      category: secret?.category ?? process.env.ANDREANI_CATEGORY ?? "1",
    });
  }

  async quote(companyId: string, dto: QuoteRequestDto) {
    const branches = await this.prisma.branch.findMany({ where: { companyId } });
    if (dto.shippingMode === "PICKUP") {
      const options =
        branches.length > 0
          ? branches.map((b) => ({ id: b.id, label: `Retiro en ${b.name}`, price: 0 }))
          : [{ id: "pickup", label: "Retiro por local", price: 0 }];
      return { mode: "PICKUP", options };
    }

    if (!dto.address) {
      throw new Error("Address required for delivery");
    }

    const provider = dto.shippingProvider ?? "OWN";
    const settings = await this.prisma.companySettings.findFirst({ where: { companyId } });
    if (!settings) {
      throw new Error("Company settings not found");
    }
    const branchId = dto.branchId ?? branches[0]?.id ?? null;

    if (provider === "ANDREANI") {
      if (!settings.enableAndreani) {
        throw new Error("Andreani shipping is disabled");
      }
      if (settings.sandboxMode) {
        return {
          mode: "DELIVERY",
          provider: "ANDREANI",
          options: this.sandbox.deterministicShipmentOptions(dto.address.postalCode),
        };
      }
      await this.licensing.requireFeature(companyId, PremiumFeatures.ANDREANI);
      if (process.env.INTEGRATIONS_MOCK === "true") {
        return {
          mode: "DELIVERY",
          provider: "ANDREANI",
          options: [
            { id: "mock-standard", label: "Andreani Standard (mock)", price: 1500, etaDays: 3 },
            { id: "mock-express", label: "Andreani Express (mock)", price: 2500, etaDays: 1 },
          ],
        };
      }
      const adapter = await this.buildAndreani(companyId);
      const options = await adapter.quote({
        postalCode: dto.address.postalCode,
        weightKg: 1,
        city: dto.address.city,
        country: dto.address.country,
      });
      return {
        mode: "DELIVERY",
        provider: "ANDREANI",
        options: options.map((opt) => ({
          id: opt.serviceId,
          label: opt.serviceName,
          price: opt.price,
          etaDays: opt.estimatedDays,
        })),
      };
    }

    if (!settings.enableOwnDelivery) {
      throw new Error("Own delivery is disabled");
    }

    const origin = { lat: settings.depotLat, lng: settings.depotLng };
    const destination = await this.geocoding.geocode(
      `${dto.address.line1} ${dto.address.city} ${dto.address.state ?? ""} ${dto.address.postalCode} ${dto.address.country}`,
    );
    const distanceKm = haversineKm(origin, destination);

    const zones = await this.prisma.shippingZone.findMany({
      where: { companyId, branchId: branchId ?? undefined },
      orderBy: { maxDistanceKm: "asc" },
    });
    if (zones.length === 0) {
      throw new Error("No shipping zones configured");
    }
    const zone = zones.find((z) => distanceKm <= z.maxDistanceKm) ?? zones[zones.length - 1];
    const cost = Number(zone.baseFee) + distanceKm * Number(zone.perKm);

    return {
      mode: "DELIVERY",
      provider: "OWN",
      options: [
        {
          id: zone.id,
          label: `${zone.name} (${distanceKm.toFixed(1)} km)`,
          price: Math.round(cost),
          etaDays: Math.ceil(distanceKm / 10) + 1,
        },
      ],
    };
  }
}
