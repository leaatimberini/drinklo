import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaService } from "@erp/db";
import { StockReservationService } from "../stock-reservations/stock-reservation.service";

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

@Injectable()
export class SandboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: StockReservationService,
  ) {}

  async getSettings(companyId: string) {
    const settings = await this.prisma.companySettings.findUnique({ where: { companyId } });
    if (!settings) {
      throw new NotFoundException("Company settings not found");
    }
    return settings;
  }

  async getStatus(companyId: string) {
    const settings = await this.getSettings(companyId);
    return {
      sandboxMode: settings.sandboxMode,
      sandboxResetAt: settings.sandboxResetAt,
      isolationMode: "companyId",
      description: "Data is isolated by companyId scoping in all sandbox reset/seed operations",
    };
  }

  async setMode(companyId: string, sandboxMode: boolean) {
    return this.prisma.companySettings.update({
      where: { companyId },
      data: { sandboxMode },
      select: {
        sandboxMode: true,
        sandboxResetAt: true,
      },
    });
  }

  async isSandboxCompany(companyId: string) {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
      select: { sandboxMode: true },
    });
    return Boolean(settings?.sandboxMode);
  }

  async resetCompany(companyId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.stockReservationLot.deleteMany({ where: { companyId } });
      await tx.stockReservation.deleteMany({ where: { companyId } });
      await tx.orderStatusEvent.deleteMany({ where: { order: { companyId } } });
      await tx.payment.deleteMany({ where: { order: { companyId } } });
      await tx.orderItem.deleteMany({ where: { order: { companyId } } });
      await tx.order.deleteMany({ where: { companyId } });
      await tx.invoice.deleteMany({ where: { companyId } });

      await tx.stockMovement.deleteMany({ where: { companyId } });
      await tx.stockItem.deleteMany({ where: { companyId } });
      await tx.stockLocation.deleteMany({ where: { companyId } });
      await tx.shippingZone.deleteMany({ where: { companyId } });

      await tx.priceRule.deleteMany({ where: { companyId } });
      await tx.priceList.deleteMany({ where: { companyId } });

      await tx.productAttribute.deleteMany({ where: { companyId } });
      await tx.productCategory.deleteMany({ where: { companyId } });
      await tx.productVariant.deleteMany({ where: { companyId } });
      await tx.product.deleteMany({ where: { companyId } });
      await tx.category.deleteMany({ where: { companyId } });

      await tx.address.deleteMany({ where: { companyId } });
      await tx.customer.deleteMany({ where: { companyId } });

      const location = await tx.stockLocation.create({
        data: {
          companyId,
          name: "Sandbox Main",
        },
      });

      const category = await tx.category.create({
        data: { companyId, name: "Sandbox Drinks" },
      });

      const priceList = await tx.priceList.create({
        data: { companyId, name: "Sandbox Retail", currency: "ARS", isDefault: true },
      });

      const products = [
        { name: "Sandbox Cola 500ml", sku: "SBX-COLA-500", barcode: "7790000000001", price: 1800, stock: 25 },
        { name: "Sandbox Agua 1L", sku: "SBX-AGUA-1000", barcode: "7790000000002", price: 1200, stock: 40 },
        { name: "Sandbox Cerveza 473ml", sku: "SBX-CERV-473", barcode: "7790000000003", price: 2200, stock: 15 },
      ];

      for (const item of products) {
        const product = await tx.product.create({
          data: { companyId, name: item.name },
        });

        const variant = await tx.productVariant.create({
          data: {
            companyId,
            productId: product.id,
            sku: item.sku,
            barcode: item.barcode,
          },
        });

        await tx.productCategory.create({
          data: {
            companyId,
            productId: product.id,
            categoryId: category.id,
          },
        });

        await tx.priceRule.create({
          data: {
            companyId,
            priceListId: priceList.id,
            productId: product.id,
            variantId: variant.id,
            minQty: 1,
            price: decimal(item.price),
          },
        });

        const stockItem = await tx.stockItem.create({
          data: {
            companyId,
            variantId: variant.id,
            locationId: location.id,
            quantity: item.stock,
            reservedQuantity: 0,
          },
        });

        await tx.stockMovement.create({
          data: {
            companyId,
            stockItemId: stockItem.id,
            delta: item.stock,
            reason: "sandbox_reset_seed",
          },
        });
      }

      await tx.shippingZone.create({
        data: {
          companyId,
          name: "Sandbox Zone A",
          maxDistanceKm: 20,
          baseFee: decimal(1000),
          perKm: decimal(100),
        },
      });

      await tx.companySettings.update({
        where: { companyId },
        data: {
          sandboxMode: true,
          sandboxResetAt: new Date(),
          billingMode: "NO_FISCAL",
          enableAfip: false,
        },
      });
    });

    return this.getStatus(companyId);
  }

  deterministicShipmentOptions(postalCode?: string) {
    const suffix = (postalCode ?? "0000").slice(-2);
    const seed = Number.parseInt(suffix, 10);
    const safeSeed = Number.isFinite(seed) ? seed : 0;
    const base = 900 + safeSeed * 5;
    return [
      { id: "sandbox-standard", label: "Andreani Sandbox Standard", price: base, etaDays: 3 },
      { id: "sandbox-express", label: "Andreani Sandbox Express", price: base + 600, etaDays: 1 },
    ];
  }

  deterministicPreference(orderId: string) {
    return {
      id: `sbx-pref-${orderId}`,
      initPoint: `https://sandbox.local/pay/${orderId}`,
    };
  }

  deterministicArcaInvoice(input: { orderRef: string; pointOfSale: number; type: string; total: number; currency: string }) {
    const caeSuffix = String(Math.abs(this.hash(input.orderRef))).padStart(8, "0").slice(0, 8);
    const number = Math.abs(this.hash(`${input.pointOfSale}:${input.orderRef}`)) % 99999999;
    const caeDue = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    return {
      cae: `SBX${caeSuffix}`,
      number,
      caeDue,
      result: "A",
      raw: {
        mode: "sandbox",
        wsaa: "simulated",
        wsfe: "simulated",
      },
    };
  }

  async approveSandboxPayment(companyId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, companyId } });
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { orderId, provider: "MERCADOPAGO" },
      });
      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "APPROVED",
            paymentId: `sbx-pay-${orderId}`,
            raw: { mode: "sandbox", approved: true },
          },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: "PAID" },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId,
          status: "PAID",
          message: "Sandbox payment approved",
        },
      });
    });

    await this.reservations.confirm(orderId);
    return { ok: true, orderId, status: "APPROVED" };
  }

  private hash(input: string) {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
