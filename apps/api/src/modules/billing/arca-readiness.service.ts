import crypto from "node:crypto";
import fs from "node:fs";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SecretsService } from "../secrets/secrets.service";
import { ImmutableAuditService } from "../immutable-audit/immutable-audit.service";
import { PdfService } from "../shared/pdf.service";
import { StorageService } from "../storage/storage.service";
import { WsaaClient, type WsaaConfig } from "./afip/wsaa.client";
import { WsfeClient, type WsfeConfig } from "./afip/wsfe.client";
import type { ArcaReadinessDryRunDto, ArcaReadinessReportDto } from "./dto/arca-readiness.dto";

export type ArcaReadinessStatus = "PASS" | "WARN" | "FAIL";

export type ArcaChecklistItem = {
  key: string;
  label: string;
  category: "technical" | "fiscal";
  status: ArcaReadinessStatus;
  required: boolean;
  message: string;
  meta?: Record<string, unknown>;
};

function asArrayInvoiceTypes(input?: Array<"A" | "B" | "C" | "M"> | null) {
  const allowed = new Set(["A", "B", "C", "M"]);
  const unique: Array<"A" | "B" | "C" | "M"> = [];
  for (const raw of input ?? []) {
    const t = String(raw).toUpperCase();
    if (!allowed.has(t)) continue;
    if (!unique.includes(t as any)) unique.push(t as any);
  }
  return unique;
}

export function validateCuit(cuitInput: unknown) {
  const normalized = String(cuitInput ?? "").replace(/\D+/g, "");
  if (normalized.length !== 11) {
    return { ok: false, normalized, reason: "length" as const };
  }
  const digits = normalized.split("").map((d) => Number(d));
  const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = factors.reduce((acc, factor, idx) => acc + factor * digits[idx], 0);
  const mod = 11 - (sum % 11);
  const checkDigit = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  const ok = checkDigit === digits[10];
  return { ok, normalized, reason: ok ? null : ("checksum" as const) };
}

function sha256Json(payload: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function signPayload(payload: unknown) {
  const secret =
    process.env.ARCA_READINESS_REPORT_SECRET ?? process.env.AUDIT_EVIDENCE_SECRET ?? process.env.JWT_SECRET ?? "arca-readiness-dev-secret";
  return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

type CertInspection = {
  ok: boolean;
  source: "pem" | "path" | "none";
  certPresent: boolean;
  keyPresent: boolean;
  certValid: boolean;
  keyValid: boolean;
  fingerprint256?: string;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  expiresInDays?: number;
  errors: string[];
};

@Injectable()
export class ArcaReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsService,
    private readonly audit: ImmutableAuditService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
  ) {}

  protected createWsaa(config: WsaaConfig) {
    return new WsaaClient(config);
  }

  protected createWsfe(config: WsfeConfig) {
    return new WsfeClient(config);
  }

  protected inspectCertificateMaterial(secretPayload: any): CertInspection {
    const errors: string[] = [];
    const certPem = secretPayload?.certPem || (secretPayload?.certPath ? this.readFileUtf8(secretPayload.certPath) : null);
    const keyPem = secretPayload?.keyPem || (secretPayload?.keyPath ? this.readFileUtf8(secretPayload.keyPath) : null);
    const source: CertInspection["source"] = secretPayload?.certPem ? "pem" : secretPayload?.certPath ? "path" : "none";

    let certInfo: crypto.X509Certificate | null = null;
    if (!certPem) {
      errors.push("cert_missing");
    } else {
      try {
        certInfo = new crypto.X509Certificate(certPem);
      } catch {
        errors.push("cert_invalid_format");
      }
    }

    if (!keyPem) {
      errors.push("key_missing");
    } else {
      try {
        crypto.createPrivateKey(keyPem);
      } catch {
        errors.push("key_invalid_format");
      }
    }

    const validTo = certInfo ? parseDate(certInfo.validTo) : null;
    const validFrom = certInfo ? parseDate(certInfo.validFrom) : null;
    const expiresInDays = validTo ? Math.floor((validTo.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : undefined;

    return {
      ok: errors.length === 0,
      source,
      certPresent: Boolean(certPem),
      keyPresent: Boolean(keyPem),
      certValid: certInfo != null,
      keyValid: !errors.includes("key_invalid_format") && Boolean(keyPem),
      fingerprint256: certInfo?.fingerprint256,
      subject: certInfo?.subject,
      issuer: certInfo?.issuer,
      validFrom: validFrom?.toISOString(),
      validTo: validTo?.toISOString(),
      expiresInDays,
      errors,
    };
  }

  private readFileUtf8(path: string) {
    try {
      return fs.readFileSync(path, "utf8");
    } catch {
      return null;
    }
  }

  private async resolveContext(companyId?: string | null) {
    const company = companyId
      ? await this.prisma.company.findUnique({ where: { id: companyId } })
      : await this.prisma.company.findFirst();
    if (!company) throw new Error("company_not_found");
    const settings = await this.prisma.companySettings.findUnique({ where: { companyId: company.id } });
    if (!settings) throw new Error("company_settings_not_found");
    const secretPayload = await this.secrets.getSecret(company.id, "ARCA");
    const secretRow = await this.prisma.secret.findUnique({
      where: { companyId_provider: { companyId: company.id, provider: "ARCA" } },
      select: { id: true, status: true, verifiedAt: true, expiresAt: true, updatedAt: true, meta: true },
    });
    return { company, settings, secretPayload, secretRow };
  }

  async getChecklist(options: { companyId?: string | null; invoiceTypes?: Array<"A" | "B" | "C" | "M"> }) {
    const { company, settings, secretPayload, secretRow } = await this.resolveContext(options.companyId);
    const cert = this.inspectCertificateMaterial(secretPayload);
    const cuit = validateCuit(settings.afipCuit);
    const invoiceTypes = asArrayInvoiceTypes(options.invoiceTypes);
    const envConfigured = ["HOMO", "PROD"].includes(String(settings.afipEnvironment ?? "HOMO").toUpperCase());
    const envEffective = process.env.AFIP_SANDBOX === "true" ? "HOMO" : String(settings.afipEnvironment ?? "HOMO").toUpperCase();
    const pointOfSale = Number(settings.afipPointOfSale ?? 0);
    const now = new Date();

    const items: ArcaChecklistItem[] = [
      {
        key: "billing_mode",
        label: "Modo fiscal ARCA habilitado",
        category: "fiscal",
        required: true,
        status: settings.billingMode === "AFIP" && settings.enableAfip ? "PASS" : "FAIL",
        message:
          settings.billingMode === "AFIP" && settings.enableAfip
            ? "ARCA habilitado en CompanySettings"
            : "Activar billingMode=AFIP y enableAfip=true",
        meta: { billingMode: settings.billingMode, enableAfip: settings.enableAfip },
      },
      {
        key: "cuit",
        label: "CUIT fiscal",
        category: "fiscal",
        required: true,
        status: cuit.ok ? "PASS" : "FAIL",
        message: cuit.ok ? "CUIT con estructura/checksum valido" : `CUIT invalido (${cuit.reason ?? "unknown"})`,
        meta: { cuit: cuit.normalized || null },
      },
      {
        key: "point_of_sale",
        label: "Punto de venta",
        category: "fiscal",
        required: true,
        status: Number.isInteger(pointOfSale) && pointOfSale > 0 ? "PASS" : "FAIL",
        message: Number.isInteger(pointOfSale) && pointOfSale > 0 ? "Punto de venta configurado" : "Configurar punto de venta > 0",
        meta: { pointOfSale: settings.afipPointOfSale ?? null },
      },
      {
        key: "comprobante_types",
        label: "Tipos de comprobante a habilitar",
        category: "fiscal",
        required: true,
        status: invoiceTypes.length > 0 ? "PASS" : "WARN",
        message: invoiceTypes.length > 0 ? `Seleccionados: ${invoiceTypes.join(", ")}` : "Seleccionar tipos de comprobante (A/B/C/M) para readiness y dry-run",
        meta: { selected: invoiceTypes, supported: ["A", "B", "C", "M"] },
      },
      {
        key: "arca_environment",
        label: "Entorno ARCA (homologacion/produccion)",
        category: "technical",
        required: true,
        status: envConfigured ? "PASS" : "FAIL",
        message: envConfigured
          ? `Configurado ${String(settings.afipEnvironment ?? "HOMO").toUpperCase()} (efectivo: ${envEffective})`
          : "Entorno invalido (usar HOMO o PROD)",
        meta: { configured: settings.afipEnvironment ?? null, effective: envEffective, afipSandboxEnvFlag: process.env.AFIP_SANDBOX ?? null },
      },
      {
        key: "certificates",
        label: "Certificado X.509 y clave privada",
        category: "technical",
        required: true,
        status: !cert.ok ? "FAIL" : cert.expiresInDays != null && cert.expiresInDays < 15 ? "WARN" : "PASS",
        message: !cert.ok
          ? `Material invalido: ${cert.errors.join(", ")}`
          : cert.expiresInDays != null && cert.expiresInDays < 15
            ? `Certificado valido pero vence en ${cert.expiresInDays} dias`
            : "Certificado y clave validos",
        meta: {
          source: cert.source,
          verifiedAt: secretRow?.verifiedAt?.toISOString() ?? null,
          secretStatus: secretRow?.status ?? null,
          certFingerprint: cert.fingerprint256 ?? (secretRow?.meta as any)?.certFingerprint ?? null,
          validTo: cert.validTo ?? null,
          issuer: cert.issuer ?? null,
          subject: cert.subject ?? null,
          expiresInDays: cert.expiresInDays ?? null,
          secretExpiresAt: secretRow?.expiresAt?.toISOString() ?? null,
        },
      },
      {
        key: "certificate_issuer",
        label: "Entidad emisora de certificado",
        category: "technical",
        required: false,
        status: settings.afipCertIssuer ? "PASS" : "WARN",
        message: settings.afipCertIssuer ? "Entidad emisora declarada" : "Completar afipCertIssuer para soporte/auditoria",
        meta: { afipCertIssuer: settings.afipCertIssuer ?? null },
      },
    ];

    const required = items.filter((i) => i.required);
    const blocking = required.filter((i) => i.status === "FAIL");
    const warnings = items.filter((i) => i.status === "WARN");
    const readiness = blocking.length === 0 ? (warnings.length ? "READY_WITH_WARNINGS" : "READY") : "NOT_READY";

    return {
      companyId: company.id,
      checkedAt: now.toISOString(),
      arca: {
        enabled: Boolean(settings.enableAfip),
        billingMode: settings.billingMode,
        environmentConfigured: settings.afipEnvironment ?? "HOMO",
        environmentEffective: envEffective,
        cuit: cuit.normalized || null,
        pointOfSale: settings.afipPointOfSale ?? null,
        selectedInvoiceTypes: invoiceTypes,
      },
      summary: {
        readiness,
        total: items.length,
        requiredTotal: required.length,
        pass: items.filter((i) => i.status === "PASS").length,
        warn: warnings.length,
        fail: items.filter((i) => i.status === "FAIL").length,
      },
      items,
    };
  }

  async runDryRun(companyId: string, actorUserId: string | null, input: ArcaReadinessDryRunDto = {}) {
    const { company, settings, secretPayload } = await this.resolveContext(companyId);
    const checklist = await this.getChecklist({ companyId, invoiceTypes: input.invoiceTypes });

    const criticalFailures = checklist.items.filter(
      (item) => item.required && item.status === "FAIL" && ["cuit", "point_of_sale", "certificates", "billing_mode"].includes(item.key),
    );
    if (criticalFailures.length > 0) {
      return {
        ok: false,
        mode: "HOMO",
        checklist,
        error: "readiness_prerequisites_failed",
        blocking: criticalFailures.map((i) => ({ key: i.key, message: i.message })),
      };
    }

    const invoiceTypes = asArrayInvoiceTypes(input.invoiceTypes).length ? asArrayInvoiceTypes(input.invoiceTypes) : (["B", "C"] as Array<"B" | "C">);
    const pointOfSale = Number(input.pointOfSale ?? settings.afipPointOfSale ?? 0);
    const amount = Number(input.amountArs ?? 1234.56);
    const env: "HOMO" = "HOMO";

    const wsaa = this.createWsaa({
      certPath: secretPayload?.certPath,
      keyPath: secretPayload?.keyPath,
      certPem: secretPayload?.certPem,
      keyPem: secretPayload?.keyPem,
      cuit: String(settings.afipCuit ?? ""),
      environment: env,
    });

    const startedAt = new Date();
    try {
      const token = await wsaa.getToken();
      const wsfe = this.createWsfe({ cuit: String(settings.afipCuit ?? ""), environment: env, token: token.token, sign: token.sign });

      const cases = [] as Array<Record<string, unknown>>;
      for (const [idx, type] of invoiceTypes.entries()) {
        try {
          const resp = await wsfe.requestCae({
            type,
            pointOfSale,
            number: idx + 1,
            total: Number(amount.toFixed(2)),
            currency: "ARS",
          });
          cases.push({
            type,
            ok: true,
            cae: resp.cae,
            caeDue: resp.caeDue instanceof Date ? resp.caeDue.toISOString() : resp.caeDue,
            result: resp.result,
            raw: resp.raw,
          });
        } catch (error: any) {
          cases.push({ type, ok: false, error: error?.message ?? String(error) });
        }
      }

      const finishedAt = new Date();
      const payload = {
        mode: env,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        tokenGeneratedAt: token.generatedAt instanceof Date ? token.generatedAt.toISOString() : null,
        pointOfSale,
        amountArs: Number(amount.toFixed(2)),
        invoiceTypes,
        cases,
      };

      await this.prisma.afipLog.create({
        data: {
          companyId: company.id,
          service: "ARCA_READINESS_DRYRUN",
          environment: env,
          response: payload as any,
        },
      });
      await this.audit.append({
        companyId: company.id,
        category: "billing",
        action: "billing.arca.readiness.dry_run",
        method: "POST",
        route: "/billing/arca/readiness/dry-run",
        statusCode: 200,
        actorUserId,
        aggregateType: "billing",
        aggregateId: company.id,
        payload: { pointOfSale, amountArs: amount, invoiceTypes, cases: cases.map((c) => ({ type: c.type, ok: c.ok, result: c.result ?? null })) },
      });

      return {
        ok: cases.every((c: any) => c.ok),
        checklist,
        ...payload,
      };
    } catch (error: any) {
      const failure = {
        mode: env,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: error?.message ?? String(error),
      };
      await this.prisma.afipLog.create({
        data: {
          companyId: company.id,
          service: "ARCA_READINESS_DRYRUN",
          environment: env,
          error: failure.error,
          response: failure as any,
        },
      });
      await this.audit.append({
        companyId: company.id,
        category: "billing",
        action: "billing.arca.readiness.dry_run",
        method: "POST",
        route: "/billing/arca/readiness/dry-run",
        statusCode: 500,
        actorUserId,
        aggregateType: "billing",
        aggregateId: company.id,
        payload: failure,
      });
      return { ok: false, checklist, ...failure };
    }
  }

  async generateReport(companyId: string, actorUserId: string | null, input: ArcaReadinessReportDto = {}) {
    const checklist = await this.getChecklist({ companyId, invoiceTypes: input.invoiceTypes });
    const dryRun = input.includeDryRun === false ? null : await this.runDryRun(companyId, actorUserId, input);
    const now = new Date();

    const manifest = {
      reportType: "ARCA_READINESS",
      generatedAt: now.toISOString(),
      companyId,
      readiness: checklist.summary.readiness,
      checklistSummary: checklist.summary,
      dryRunSummary: dryRun
        ? {
            ok: dryRun.ok,
            mode: (dryRun as any).mode,
            cases: Array.isArray((dryRun as any).cases)
              ? (dryRun as any).cases.map((c: any) => ({ type: c.type, ok: c.ok, result: c.result ?? null }))
              : [],
          }
        : null,
      notes: input.notes ?? null,
    };
    const payloadHash = sha256Json(manifest);
    const signature = signPayload({ manifest, payloadHash });
    const html = this.renderReadinessReportHtml({ checklist, dryRun, manifest, payloadHash, signature });
    const pdfBuffer = await this.pdf.renderPdf(html);
    const storageKey = `pdfs/arca-readiness/${companyId}/${now.toISOString().replace(/[:.]/g, "-")}.pdf`;
    await this.storage.put(storageKey, Buffer.from(pdfBuffer), "application/pdf");
    const signedUrl = await this.storage.signedUrl(storageKey);

    await this.prisma.afipLog.create({
      data: {
        companyId,
        service: "ARCA_READINESS_REPORT",
        environment: String(checklist.arca.environmentEffective ?? "HOMO"),
        response: { manifest, payloadHash, signature, storageKey } as any,
      },
    });
    await this.audit.append({
      companyId,
      category: "billing",
      action: "billing.arca.readiness.report",
      method: "POST",
      route: "/billing/arca/readiness/report",
      statusCode: 200,
      actorUserId,
      aggregateType: "billing",
      aggregateId: companyId,
      payload: { manifest, payloadHash, signature, storageKey },
    });

    return {
      ok: true,
      manifest,
      payloadHash,
      signature,
      signatureAlgorithm: "HMAC-SHA256",
      storageKey,
      signedUrl,
      checklist,
      dryRun,
    };
  }

  private renderReadinessReportHtml(args: { checklist: any; dryRun: any; manifest: any; payloadHash: string; signature: string }) {
    const rows = (args.checklist.items ?? [])
      .map(
        (item: ArcaChecklistItem) => `
          <tr>
            <td>${item.category}</td>
            <td>${item.label}</td>
            <td>${item.required ? "si" : "no"}</td>
            <td>${item.status}</td>
            <td>${item.message}</td>
          </tr>`,
      )
      .join("");
    const dryRunCases = Array.isArray(args.dryRun?.cases)
      ? args.dryRun.cases
          .map(
            (c: any) => `
          <tr>
            <td>${c.type ?? "-"}</td>
            <td>${c.ok ? "OK" : "FAIL"}</td>
            <td>${c.result ?? "-"}</td>
            <td>${c.cae ?? c.error ?? "-"}</td>
          </tr>`,
          )
          .join("")
      : "<tr><td colspan=\"4\">Sin dry-run incluido</td></tr>";

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111827; }
            h1,h2 { margin: 0 0 8px; }
            .muted { color: #6b7280; font-size: 12px; }
            .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px; font-size: 12px; text-align: left; vertical-align: top; }
            th { background: #f9fafb; }
            code { font-size: 10px; }
          </style>
        </head>
        <body>
          <h1>ARCA (ex AFIP) Readiness Report</h1>
          <p class="muted">Generado: ${args.manifest.generatedAt}</p>
          <div class="box">
            <strong>Readiness:</strong> ${args.manifest.readiness}<br/>
            <strong>Checklist:</strong> PASS ${args.manifest.checklistSummary.pass} / WARN ${args.manifest.checklistSummary.warn} / FAIL ${args.manifest.checklistSummary.fail}
          </div>
          <h2>Checklist tecnico/fiscal</h2>
          <table>
            <thead><tr><th>Categoria</th><th>Item</th><th>Requerido</th><th>Estado</th><th>Detalle</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <h2>Dry Run (Homologacion)</h2>
          <table>
            <thead><tr><th>Tipo</th><th>Estado</th><th>Resultado</th><th>CAE/Error</th></tr></thead>
            <tbody>${dryRunCases}</tbody>
          </table>
          <div class="box">
            <div><strong>Payload Hash:</strong> <code>${args.payloadHash}</code></div>
            <div><strong>Signature (HMAC-SHA256):</strong> <code>${args.signature}</code></div>
          </div>
        </body>
      </html>
    `;
  }
}
