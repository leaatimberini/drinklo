import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaService } from "@erp/db";
import { WsaaClient } from "./afip/wsaa.client";
import { WsfeClient } from "./afip/wsfe.client";
import type { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { LicensingService } from "../licensing/licensing.service";
import { PremiumFeatures } from "../licensing/license.types";
import { SecretsService } from "../secrets/secrets.service";
import { SandboxService } from "../sandbox/sandbox.service";

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licensing: LicensingService,
    private readonly secrets: SecretsService,
    private readonly sandbox: SandboxService,
  ) {}

  async createInvoice(dto: CreateInvoiceDto) {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new Error("Company not found");
    }

    const settings = await this.prisma.companySettings.findFirst({ where: { companyId: company.id } });
    if (!settings) {
      throw new Error("Company settings not found");
    }

    if (settings.billingMode === "NO_FISCAL" || !settings.enableAfip) {
      return {
        mode: "NO_FISCAL",
        message: "Billing disabled",
      };
    }

    if (settings.sandboxMode) {
      const deterministic = this.sandbox.deterministicArcaInvoice({
        orderRef: dto.saleId ?? `${dto.type}-${dto.pointOfSale}`,
        pointOfSale: dto.pointOfSale,
        type: dto.type,
        total: dto.total,
        currency: dto.currency ?? "ARS",
      });
      const invoice = await this.prisma.invoice.create({
        data: {
          companyId: company.id,
          saleId: dto.saleId ?? null,
          type: dto.type,
          pointOfSale: dto.pointOfSale,
          number: deterministic.number,
          cae: deterministic.cae,
          caeDue: deterministic.caeDue,
          total: new Prisma.Decimal(dto.total),
          currency: dto.currency ?? "ARS",
          status: deterministic.result,
          raw: deterministic.raw,
        },
      });
      await this.prisma.afipLog.create({
        data: {
          companyId: company.id,
          service: "ARCA_SANDBOX",
          environment: "HOMO",
          response: deterministic.raw as any,
        },
      });
      await this.prisma.eventLog.create({
        data: {
          companyId: company.id,
          name: "FeatureUsageEvent",
          source: "api",
          schemaVersion: 1,
          occurredAt: new Date(),
          payload: {
            feature: "arca",
            action: "invoice_created",
            mode: "sandbox",
            result: deterministic.result,
          },
          status: "stored",
        },
      });
      return invoice;
    }

    await this.licensing.requireFeature(company.id, PremiumFeatures.AFIP);

    const env =
      process.env.AFIP_SANDBOX === "true"
        ? "HOMO"
        : ((settings.afipEnvironment ?? "HOMO") as "HOMO" | "PROD");
    const arcaSecret = await this.secrets.getSecret(company.id, "ARCA");
    const wsaa = new WsaaClient({
      certPath: arcaSecret?.certPath ?? process.env.AFIP_CERT_PATH ?? "",
      keyPath: arcaSecret?.keyPath ?? process.env.AFIP_KEY_PATH ?? "",
      certPem: arcaSecret?.certPem,
      keyPem: arcaSecret?.keyPem,
      cuit: settings.afipCuit ?? "",
      environment: env,
    });

    const wsaaToken = await this.withRetry(() => wsaa.getToken(), "WSAA", company.id, env);

    const wsfe = new WsfeClient({
      cuit: settings.afipCuit ?? "",
      environment: env,
      token: wsaaToken.token,
      sign: wsaaToken.sign,
    });

    const lastNumber = await this.prisma.invoice.count({
      where: { companyId: company.id, type: dto.type, pointOfSale: dto.pointOfSale },
    });
    const nextNumber = lastNumber + 1;

    const caeResponse = await this.withRetry(
      () =>
        wsfe.requestCae({
          type: dto.type,
          pointOfSale: dto.pointOfSale,
          number: nextNumber,
          total: dto.total,
          currency: dto.currency ?? "ARS",
        }),
      "WSFE",
      company.id,
      env,
    );

    const invoice = await this.prisma.invoice.create({
      data: {
        companyId: company.id,
        saleId: dto.saleId ?? null,
        type: dto.type,
        pointOfSale: dto.pointOfSale,
        number: nextNumber,
        cae: caeResponse.cae,
        caeDue: caeResponse.caeDue,
        total: new Prisma.Decimal(dto.total),
        currency: dto.currency ?? "ARS",
        status: caeResponse.result,
        raw: caeResponse.raw,
      },
    });

    await this.prisma.eventLog.create({
      data: {
        companyId: company.id,
        name: "FeatureUsageEvent",
        source: "api",
        schemaVersion: 1,
        occurredAt: new Date(),
        payload: {
          feature: "arca",
          action: "invoice_created",
          mode: env === "HOMO" ? "homo" : "prod",
          result: caeResponse.result,
        },
        status: "stored",
      },
    });

    return invoice;
  }

  async getInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }

  private async withRetry<T>(fn: () => Promise<T>, service: string, companyId: string, env: string) {
    const attempts = 3;
    let lastError: any;
    for (let i = 0; i < attempts; i += 1) {
      try {
        const result = await fn();
        await this.prisma.afipLog.create({
          data: { companyId, service, environment: env, response: result as any },
        });
        return result;
      } catch (error: any) {
        lastError = error;
        await this.prisma.afipLog.create({
          data: {
            companyId,
            service,
            environment: env,
            error: error?.message ?? String(error),
          },
        });
      }
    }
    throw lastError;
  }
}
