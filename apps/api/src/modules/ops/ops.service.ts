import { Injectable } from "@nestjs/common";
import { getRequestLogs } from "./log-store";
import { SecretsService } from "../secrets/secrets.service";
import { PrismaService } from "../prisma/prisma.service";
import { MetricsService } from "../metrics/metrics.service";
import { redactDeep } from "../data-governance/dlp-redactor";

export type OpsError = {
  id: string;
  at: string;
  route?: string;
  message: string;
  stack?: string;
  requestId?: string;
  userId?: string;
  companyId?: string;
};

export type OpsJobFailure = {
  id: string;
  at: string;
  queue?: string;
  name?: string;
  reason?: string;
};

@Injectable()
export class OpsService {
  constructor(
    private readonly secrets: SecretsService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}
  private errors: OpsError[] = [];
  private jobFailures: OpsJobFailure[] = [];

  addError(error: OpsError) {
    const redacted = redactDeep(error);
    this.errors.unshift(redacted);
    this.errors = this.errors.slice(0, 50);
    this.metrics.recordAppError();
  }

  addJobFailure(failure: OpsJobFailure) {
    this.jobFailures.unshift(failure);
    this.jobFailures = this.jobFailures.slice(0, 50);
    this.metrics.recordJobFailure();
    this.metrics.setJobFailuresCurrent(this.jobFailures.length);
  }

  async getSnapshot(companyId?: string) {
    let secretsStatus = { expired: 0, unverified: 0 };
    if (companyId) {
      secretsStatus = await this.secrets.getStatus(companyId);
    } else {
      const company = await this.prisma.company.findFirst();
      if (company) {
        secretsStatus = await this.secrets.getStatus(company.id);
      }
    }
    return {
      errors: this.errors,
      jobFailures: this.jobFailures,
      secrets: secretsStatus,
    };
  }

  async getDiagnosticBundle(limit = 50, companyId?: string) {
    const envAllowlist = [
      "NODE_ENV",
      "CORS_ORIGINS",
      "PAYMENT_SANDBOX",
      "AFIP_SANDBOX",
      "INTEGRATIONS_MOCK",
      "STORAGE_BUCKET",
      "STORAGE_REGION",
      "STORAGE_ENDPOINT",
      "STORAGE_FORCE_PATH_STYLE",
    ];

    const env = envAllowlist.reduce((acc, key) => {
      acc[key] = process.env[key];
      return acc;
    }, {} as Record<string, unknown>);

    let secretsStatus = { expired: 0, unverified: 0 };
    if (companyId) {
      secretsStatus = await this.secrets.getStatus(companyId);
    } else {
      const company = await this.prisma.company.findFirst();
      if (company) {
        secretsStatus = await this.secrets.getStatus(company.id);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      version: {
        commit: process.env.GIT_COMMIT ?? "dev",
        buildDate: process.env.BUILD_DATE ?? new Date().toISOString(),
        node: process.version,
      },
      env,
      logs: getRequestLogs(limit),
      errors: this.errors,
      jobFailures: this.jobFailures,
      secrets: secretsStatus,
    };
  }
}
