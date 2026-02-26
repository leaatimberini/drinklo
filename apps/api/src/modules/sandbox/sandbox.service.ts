import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
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

  async getDemoStatus(companyId: string) {
    const status = await this.getStatus(companyId);
    return {
      ...status,
      demoMode: status.sandboxMode,
      resetAction: "admin/sandbox/demo-reset",
      snapshot: "demo-bebidas-v1",
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

  private async ensureDemoResetAllowed(companyId: string) {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
      select: { sandboxMode: true },
    });
    if (!settings?.sandboxMode) {
      throw new ForbiddenException("demo_mode_reset_disabled_for_non_sandbox_company");
    }
  }

  async resetCompany(companyId: string) {
    return this.resetDemoSnapshot(companyId);
  }

  async resetDemoSnapshot(companyId: string) {
    await this.ensureDemoResetAllowed(companyId);
    await this.prisma.$transaction(async (tx: unknown) => {
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

      await tx.automationSendLog?.deleteMany?.({ where: { companyId } });
      await tx.flowMetric?.deleteMany?.({ where: { companyId } });
      await tx.action?.deleteMany?.({ where: { flow: { companyId } } });
      await tx.flow?.deleteMany?.({ where: { companyId } });
      await tx.campaign?.deleteMany?.({ where: { companyId } });
      await tx.trigger?.deleteMany?.({ where: { companyId } });
      await tx.segment?.deleteMany?.({ where: { companyId } });
      await tx.emailEventLog?.deleteMany?.({ where: { companyId } });

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
      const seededVariants: Array<{ productId: string; variantId: string; name: string; unitPrice: number }> = [];

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

        seededVariants.push({
          productId: product.id,
          variantId: variant.id,
          name: item.name,
          unitPrice: item.price,
        });
      }

      const customerA = await tx.customer.create({
        data: {
          companyId,
          name: "Cliente Demo Uno",
          email: "cliente1@demo.local",
          phone: "1111111111",
        },
      });
      await tx.address.create({
        data: {
          companyId,
          customerId: customerA.id,
          line1: "Calle Demo 123",
          city: "CABA",
          postalCode: "C1000",
          country: "AR",
        },
      });
      const customerB = await tx.customer.create({
        data: {
          companyId,
          name: "Cliente Demo Dos",
          email: "cliente2@demo.local",
          phone: "2222222222",
        },
      });
      await tx.address.create({
        data: {
          companyId,
          customerId: customerB.id,
          line1: "Av Demo 456",
          city: "Rosario",
          postalCode: "S2000",
          country: "AR",
        },
      });

      const order1Subtotal = decimal((seededVariants[0]?.unitPrice ?? 1800) + (seededVariants[1]?.unitPrice ?? 1200) * 2);
      const order1 = await tx.order.create({
        data: {
          companyId,
          customerName: customerA.name,
          customerEmail: customerA.email,
          customerPhone: customerA.phone,
          shippingMode: "DELIVERY",
          shippingProvider: "OWN",
          shippingCost: decimal(900),
          subtotal: order1Subtotal,
          discountTotal: decimal(0),
          giftCardAmount: decimal(0),
          status: "PAID",
          addressLine1: "Calle Demo 123",
          city: "CABA",
          postalCode: "C1000",
          country: "AR",
        },
      });
      await tx.orderItem.create({
        data: {
          orderId: order1.id,
          productId: seededVariants[0]?.productId,
          variantId: seededVariants[0]?.variantId,
          name: seededVariants[0]?.name ?? "Sandbox Cola 500ml",
          sku: "SBX-COLA-500",
          quantity: 1,
          unitPrice: decimal(seededVariants[0]?.unitPrice ?? 1800),
        },
      });
      await tx.orderItem.create({
        data: {
          orderId: order1.id,
          productId: seededVariants[1]?.productId,
          variantId: seededVariants[1]?.variantId,
          name: seededVariants[1]?.name ?? "Sandbox Agua 1L",
          sku: "SBX-AGUA-1000",
          quantity: 2,
          unitPrice: decimal(seededVariants[1]?.unitPrice ?? 1200),
        },
      });
      await tx.payment.create({
        data: {
          orderId: order1.id,
          provider: "MERCADOPAGO",
          paymentId: `sbx-pay-${order1.id}`,
          status: "APPROVED",
          amount: decimal(Number(order1Subtotal) + 900),
          currency: "ARS",
          raw: { mode: "demo_snapshot" },
        },
      });
      await tx.orderStatusEvent.create({ data: { orderId: order1.id, status: "CREATED", message: "Demo snapshot order created" } });
      await tx.orderStatusEvent.create({ data: { orderId: order1.id, status: "PAID", message: "Demo snapshot paid order" } });

      const order2Subtotal = decimal(seededVariants[2]?.unitPrice ?? 2200);
      const order2 = await tx.order.create({
        data: {
          companyId,
          customerName: customerB.name,
          customerEmail: customerB.email,
          customerPhone: customerB.phone,
          shippingMode: "PICKUP",
          shippingCost: decimal(0),
          subtotal: order2Subtotal,
          discountTotal: decimal(0),
          giftCardAmount: decimal(0),
          status: "CREATED",
        },
      });
      await tx.orderItem.create({
        data: {
          orderId: order2.id,
          productId: seededVariants[2]?.productId,
          variantId: seededVariants[2]?.variantId,
          name: seededVariants[2]?.name ?? "Sandbox Cerveza 473ml",
          sku: "SBX-CERV-473",
          quantity: 1,
          unitPrice: decimal(seededVariants[2]?.unitPrice ?? 2200),
        },
      });
      await tx.orderStatusEvent.create({ data: { orderId: order2.id, status: "CREATED", message: "Demo snapshot pickup order" } });

      await tx.campaign.createMany?.({
        data: [
          { companyId, name: "Demo Bienvenida Trial", status: "ACTIVE" },
          { companyId, name: "Demo Recuperacion Carrito", status: "DRAFT" },
          { companyId, name: "Demo Promocion Mayorista", status: "PAUSED" },
        ],
      });

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

    const status = await this.getDemoStatus(companyId);
    return {
      ...status,
      snapshotApplied: "demo-bebidas-v1",
      resetIncludes: ["catalog", "customers", "orders", "campaigns"],
    };
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

  deterministicPreapproval(companyId: string, amount: number, tier: string) {
    const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return {
      id: `sbx-preapp-${companyId}`,
      status: "authorized",
      reason: `Plan ${tier}`,
      auto_recurring: {
        transaction_amount: amount,
        currency_id: "ARS",
        frequency: 1,
        frequency_type: "months",
      },
      next_payment_date: nextBillingDate.toISOString(),
      external_reference: companyId,
      init_point: `https://sandbox.local/subscriptions/${companyId}`,
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

    await this.prisma.$transaction(async (tx: unknown) => {
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
