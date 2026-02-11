import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SecretsService } from "../secrets/secrets.service";
import { AndreaniDevelopersAdapter } from "../checkout/adapters/andreani.adapter";

type HealthStatus = "OK" | "WARN" | "FAIL";

type HealthResult = {
  provider: string;
  status: HealthStatus;
  message?: string;
  checkedAt: string;
  meta?: Record<string, any>;
};

@Injectable()
export class IntegrationsHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsService,
  ) {}

  private async log(
    companyId: string,
    provider: string,
    status: HealthStatus,
    message?: string,
    meta?: Record<string, any>,
    actorId?: string,
  ) {
    await this.prisma.integrationHealthLog.create({
      data: {
        companyId,
        provider,
        status,
        message,
        meta: meta ?? undefined,
        actorId: actorId ?? null,
      },
    });
  }

  async getLogs(companyId: string, limit = 50) {
    return this.prisma.integrationHealthLog.findMany({
      where: { companyId },
      orderBy: { checkedAt: "desc" },
      take: limit,
    });
  }

  async checkMercadoPago(companyId: string, actorId?: string): Promise<HealthResult> {
    const secret = await this.secrets.getSecret(companyId, "MERCADOPAGO");
    const accessToken = secret?.accessToken ?? process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
    const checkedAt = new Date().toISOString();
    if (!accessToken) {
      const status: HealthStatus = "WARN";
      const message = "Missing Mercado Pago access token";
      await this.log(companyId, "MERCADOPAGO", status, message, undefined, actorId);
      return { provider: "MERCADOPAGO", status, message, checkedAt };
    }

    try {
      const res = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const status: HealthStatus = res.status === 401 ? "FAIL" : "WARN";
        const message = `Mercado Pago auth failed (${res.status})`;
        await this.log(companyId, "MERCADOPAGO", status, message, { status: res.status }, actorId);
        return { provider: "MERCADOPAGO", status, message, checkedAt };
      }
      const data = await res.json().catch(() => ({}));
      const status: HealthStatus = "OK";
      const message = "Mercado Pago OK";
      await this.log(companyId, "MERCADOPAGO", status, message, { user: data?.id }, actorId);
      return { provider: "MERCADOPAGO", status, message, checkedAt, meta: { user: data?.id } };
    } catch (error: any) {
      const status: HealthStatus = "FAIL";
      const message = error?.message ?? "Mercado Pago check failed";
      await this.log(companyId, "MERCADOPAGO", status, message, undefined, actorId);
      return { provider: "MERCADOPAGO", status, message, checkedAt };
    }
  }

  async testMercadoPagoWebhook(companyId: string, actorId?: string) {
    const eventId = `test-${crypto.randomUUID()}`;
    let duplicateDetected = false;
    try {
      await this.prisma.webhookLog.create({
        data: {
          provider: "mercadopago",
          eventId,
          payload: { test: true },
          status: "test",
        },
      });
      try {
        await this.prisma.webhookLog.create({
          data: {
            provider: "mercadopago",
            eventId,
            payload: { test: true },
            status: "test-duplicate",
          },
        });
      } catch {
        duplicateDetected = true;
      }
    } finally {
      await this.log(
        companyId,
        "MERCADOPAGO_WEBHOOK",
        duplicateDetected ? "OK" : "WARN",
        duplicateDetected ? "Duplicate detection OK" : "Duplicate detection not triggered",
        { eventId },
        actorId,
      );
    }
    return { ok: true, duplicateDetected, eventId };
  }

  async checkAndreani(companyId: string, actorId?: string): Promise<HealthResult> {
    const settings = await this.prisma.companySettings.findFirst({ where: { companyId } });
    const checkedAt = new Date().toISOString();
    if (!settings?.enableAndreani) {
      const status: HealthStatus = "WARN";
      const message = "Andreani disabled in settings";
      await this.log(companyId, "ANDREANI", status, message, undefined, actorId);
      return { provider: "ANDREANI", status, message, checkedAt };
    }

    if (process.env.INTEGRATIONS_MOCK === "true") {
      const status: HealthStatus = "OK";
      const message = "Andreani mock mode";
      await this.log(companyId, "ANDREANI", status, message, { mock: true }, actorId);
      return { provider: "ANDREANI", status, message, checkedAt, meta: { mock: true } };
    }

    const secret = await this.secrets.getSecret(companyId, "ANDREANI");
    const adapter = new AndreaniDevelopersAdapter({
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

    try {
      const options = await adapter.quote({
        postalCode: process.env.ANDREANI_TEST_POSTAL ?? "C1000",
        city: process.env.ANDREANI_TEST_CITY ?? "CABA",
        country: process.env.ANDREANI_TEST_COUNTRY ?? "AR",
        weightKg: Number(process.env.ANDREANI_TEST_WEIGHT_KG ?? 1),
      });

      let createResult: any = null;
      if (process.env.ANDREANI_TEST_CREATE === "true") {
        createResult = await adapter.createShipment({
          orderId: `test-${Date.now()}`,
          sender: {
            name: process.env.ANDREANI_TEST_SENDER_NAME ?? "ERP Test",
            address: process.env.ANDREANI_TEST_SENDER_ADDRESS ?? "Av. Siempre Viva 123",
            postalCode: process.env.ANDREANI_TEST_SENDER_POSTAL ?? "C1000",
            city: process.env.ANDREANI_TEST_SENDER_CITY ?? "CABA",
            country: process.env.ANDREANI_TEST_SENDER_COUNTRY ?? "AR",
          },
          recipient: {
            name: process.env.ANDREANI_TEST_RECIPIENT_NAME ?? "ERP Test",
            address: process.env.ANDREANI_TEST_RECIPIENT_ADDRESS ?? "Calle 1 234",
            postalCode: process.env.ANDREANI_TEST_RECIPIENT_POSTAL ?? "C1000",
            city: process.env.ANDREANI_TEST_RECIPIENT_CITY ?? "CABA",
            country: process.env.ANDREANI_TEST_RECIPIENT_COUNTRY ?? "AR",
          },
          packages: [{ weightKg: 1, declaredValue: 1000 }],
        });
      }

      let trackResult: any = null;
      const trackingCode = process.env.ANDREANI_TEST_TRACKING_CODE;
      if (trackingCode) {
        trackResult = await adapter.track(trackingCode);
      }

      const status: HealthStatus = "OK";
      const message = "Andreani OK";
      await this.log(
        companyId,
        "ANDREANI",
        status,
        message,
        {
          quote: options?.[0]?.price ?? null,
          create: createResult?.trackingCode ?? null,
          track: trackResult?.status ?? null,
        },
        actorId,
      );
      return {
        provider: "ANDREANI",
        status,
        message,
        checkedAt,
        meta: {
          quote: options?.[0]?.price ?? null,
          create: createResult?.trackingCode ?? null,
          track: trackResult?.status ?? null,
        },
      };
    } catch (error: any) {
      const status: HealthStatus = "FAIL";
      const message = error?.message ?? "Andreani check failed";
      await this.log(companyId, "ANDREANI", status, message, undefined, actorId);
      return { provider: "ANDREANI", status, message, checkedAt };
    }
  }
}
