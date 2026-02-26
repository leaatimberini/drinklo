import crypto from "node:crypto";
import type { PrismaClient } from "./generated/prisma";
import { buildSingleFileZip, hashEvidencePayload, stableStringify } from "./compliance-evidence";

type AnyPrisma = PrismaClient | any;

export type EnterpriseSecurityPackPayload = {
  generatedAt: string;
  installation: {
    installationId: string;
    instanceId: string;
    clientName: string | null;
    domain: string | null;
    version: string | null;
    releaseChannel: string | null;
    healthStatus: string | null;
  };
  iam: {
    ssoEnabled: boolean | null;
    mfaEnforced: boolean | null;
    scimEnabled: boolean | null;
    lastSyncAt: string | null;
  };
  slos: {
    p95Ms: number | null;
    errorRate: number | null;
    webhookRetryRate: number | null;
    measuredAt: string | null;
  };
  backups: {
    latestBackupAt: string | null;
    latestBackupStatus: string | null;
    recent30dCount: number;
    lastRestoreVerification: {
      status: string | null;
      environment: string | null;
      finishedAt: string | null;
    };
    restoreVerifications30d: number;
  };
  disasterRecovery: {
    lastDrillAt: string | null;
    lastDrillStatus: string | null;
    lastDrillRpoMinutes: number | null;
    lastDrillRtoMinutes: number | null;
    drills90d: number;
  };
  audit: {
    complianceEvidenceCount: number;
    recentEvidence: Array<{
      id: string;
      evidenceType: string;
      capturedAt: string;
      payloadHash: string;
      tags: string[];
    }>;
    sodAccessReviewLatest: {
      capturedAt: string | null;
      activePolicies: number;
      violations24h: number;
      openCampaigns: number;
      overdueCampaigns: number;
    };
    legalAcceptancesCount: number;
    latestLegalAcceptances: Array<{
      docType: string;
      version: string;
      acceptedAt: string;
      source: string;
    }>;
  };
  sbom: {
    latestReports: Array<{
      id: string;
      status: string;
      sha: string | null;
      runId: string | null;
      createdAt: string;
      summary: any;
    }>;
    latestAt: string | null;
    reportCount90d: number;
  };
  dast: {
    latestReports: Array<{
      id: string;
      status: string;
      runId: string | null;
      createdAt: string;
      summary: any;
    }>;
    findingsOpenBySeverity: Record<string, number>;
    latestAt: string | null;
    findingsTotal: number;
  };
  accessibility: {
    latestReport: {
      version: string | null;
      score: number | null;
      criticalViolations: number;
      seriousViolations: number;
      totalViolations: number;
      measuredAt: string | null;
    };
  };
  policies: {
    complianceControls: Array<{
      key: string;
      domain: string;
      title: string;
      status: string;
      updatedAt: string;
    }>;
    legalDocuments: Array<{
      type: string;
      version: string;
      locale: string;
      effectiveAt: string;
      title: string;
    }>;
  };
  evidenceManifest: {
    sectionHashes: Record<string, string>;
    payloadHash: string;
  };
};

export type EnterpriseSecurityPackSigned = {
  payload: EnterpriseSecurityPackPayload;
  manifest: {
    version: 1;
    kind: "enterprise_security_pack";
    generatedAt: string;
    instanceId: string;
    payloadHash: string;
    sectionHashes: Record<string, string>;
    zipHash?: string;
    pdfHash?: string;
  };
  signature: string;
  algorithm: "HMAC-SHA256";
};

function getSigningSecret() {
  return (
    process.env.ENTERPRISE_SECURITY_PACK_SIGNING_SECRET ??
    process.env.SOC2_EVIDENCE_SIGNING_SECRET ??
    process.env.CONTROL_PLANE_ADMIN_TOKEN ??
    "enterprise-security-pack-dev-secret"
  );
}

export function hashBinarySha256(input: Buffer) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function summarizeDastFindingsBySeverity(rows: Array<{ severity: string }>) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const severity = String(row.severity || "unknown").toLowerCase();
    counts[severity] = (counts[severity] ?? 0) + 1;
  }
  return counts;
}

function toIso(value: Date | null | undefined) {
  return value?.toISOString?.() ?? null;
}

function buildSectionHashes(payload: Omit<EnterpriseSecurityPackPayload, "evidenceManifest">) {
  return {
    installation: hashEvidencePayload(payload.installation),
    iam: hashEvidencePayload(payload.iam),
    slos: hashEvidencePayload(payload.slos),
    backups: hashEvidencePayload(payload.backups),
    disasterRecovery: hashEvidencePayload(payload.disasterRecovery),
    audit: hashEvidencePayload(payload.audit),
    sbom: hashEvidencePayload(payload.sbom),
    dast: hashEvidencePayload(payload.dast),
    accessibility: hashEvidencePayload(payload.accessibility),
    policies: hashEvidencePayload(payload.policies),
  };
}

export async function buildEnterpriseSecurityPackPayload(prisma: AnyPrisma, installationId: string): Promise<EnterpriseSecurityPackPayload> {
  const installation = await prisma.installation.findUnique({ where: { id: installationId } });
  if (!installation) throw new Error("installation_not_found");

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    backups30d,
    latestRestore,
    restores30d,
    latestDrill,
    drills90d,
    evidenceRows,
    evidenceCount,
    sodReport,
    legalAcceptances,
    sbomReports,
    sbomCount90d,
    dastReports,
    dastFindingsOpen,
    accessibilityLatest,
    complianceControls,
    legalDocs,
  ] = await Promise.all([
    prisma.backupRecord.findMany({ where: { installationId, createdAt: { gte: d30 } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.restoreVerification.findFirst({ where: { installationId }, orderBy: { finishedAt: "desc" } }),
    prisma.restoreVerification.count({ where: { installationId, createdAt: { gte: d30 } } }),
    prisma.disasterRecoveryDrill.findFirst({ where: { installationId }, orderBy: { startedAt: "desc" } }),
    prisma.disasterRecoveryDrill.count({ where: { installationId, startedAt: { gte: d90 } } }),
    prisma.complianceEvidence.findMany({
      where: { installationId },
      orderBy: { capturedAt: "desc" },
      take: 20,
      select: { id: true, evidenceType: true, capturedAt: true, payloadHash: true, tags: true },
    }),
    prisma.complianceEvidence.count({ where: { installationId } }),
    prisma.sodAccessReviewReport.findFirst({ where: { installationId }, orderBy: { capturedAt: "desc" } }),
    prisma.legalAcceptance.findMany({
      where: { installationId },
      orderBy: { acceptedAt: "desc" },
      take: 20,
      select: { docType: true, version: true, acceptedAt: true, source: true },
    }),
    prisma.securityReport.findMany({
      where: { installationId, kind: { in: ["sbom", "SBOM"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, status: true, sha: true, runId: true, createdAt: true, summary: true },
    }),
    prisma.securityReport.count({ where: { installationId, kind: { in: ["sbom", "SBOM"] }, createdAt: { gte: d90 } } }),
    prisma.securityReport.findMany({
      where: { installationId, kind: { in: ["dast", "DAST", "zap", "ZAP"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, status: true, runId: true, createdAt: true, summary: true },
    }),
    prisma.dastFinding.findMany({
      where: { installationId, status: { in: ["open", "triaged"] } },
      select: { severity: true },
    }),
    prisma.accessibilityReport.findFirst({
      where: { installationId },
      orderBy: { measuredAt: "desc" },
      select: {
        version: true,
        score: true,
        criticalViolations: true,
        seriousViolations: true,
        totalViolations: true,
        measuredAt: true,
      },
    }),
    prisma.complianceControl.findMany({
      orderBy: [{ domain: "asc" }, { key: "asc" }],
      select: { key: true, domain: true, title: true, status: true, updatedAt: true },
      take: 200,
    }),
    prisma.legalDocument.findMany({
      orderBy: [{ effectiveAt: "desc" }],
      select: { type: true, version: true, locale: true, effectiveAt: true, title: true },
      take: 50,
    }),
  ]);

  const payloadBase: Omit<EnterpriseSecurityPackPayload, "evidenceManifest"> = {
    generatedAt: now.toISOString(),
    installation: {
      installationId: installation.id,
      instanceId: installation.instanceId,
      clientName: installation.clientName ?? null,
      domain: installation.domain ?? null,
      version: installation.version ?? null,
      releaseChannel: installation.releaseChannel ?? null,
      healthStatus: installation.healthStatus ?? null,
    },
    iam: {
      ssoEnabled: installation.iamSsoEnabled ?? null,
      mfaEnforced: installation.iamMfaEnforced ?? null,
      scimEnabled: installation.iamScimEnabled ?? null,
      lastSyncAt: toIso(installation.iamLastSyncAt),
    },
    slos: {
      p95Ms: installation.sloP95Ms ?? null,
      errorRate: installation.sloErrorRate ?? null,
      webhookRetryRate: installation.sloWebhookRetryRate ?? null,
      measuredAt: toIso(installation.sloUpdatedAt),
    },
    backups: {
      latestBackupAt: toIso(installation.lastBackupAt) ?? toIso(backups30d[0]?.createdAt),
      latestBackupStatus: installation.backupStatus ?? null,
      recent30dCount: backups30d.length,
      lastRestoreVerification: {
        status: latestRestore?.status ?? null,
        environment: latestRestore?.environment ?? null,
        finishedAt: toIso(latestRestore?.finishedAt) ?? toIso(latestRestore?.createdAt),
      },
      restoreVerifications30d: restores30d,
    },
    disasterRecovery: {
      lastDrillAt: toIso(latestDrill?.startedAt) ?? toIso(installation.lastDrillAt),
      lastDrillStatus: latestDrill?.status ?? installation.lastDrillStatus ?? null,
      lastDrillRpoMinutes: latestDrill?.rpoMinutes ?? installation.lastDrillRpoMin ?? null,
      lastDrillRtoMinutes: latestDrill?.rtoMinutes ?? installation.lastDrillRtoMin ?? null,
      drills90d,
    },
    audit: {
      complianceEvidenceCount: evidenceCount,
      recentEvidence: evidenceRows.map((row: any) => ({
        id: row.id,
        evidenceType: row.evidenceType,
        capturedAt: row.capturedAt.toISOString(),
        payloadHash: row.payloadHash,
        tags: Array.isArray(row.tags) ? row.tags : [],
      })),
      sodAccessReviewLatest: {
        capturedAt: toIso(sodReport?.capturedAt),
        activePolicies: Number(sodReport?.activePolicies ?? 0),
        violations24h: Number(sodReport?.violations24h ?? 0),
        openCampaigns: Number(sodReport?.openCampaigns ?? 0),
        overdueCampaigns: Number(sodReport?.overdueCampaigns ?? 0),
      },
      legalAcceptancesCount: legalAcceptances.length,
      latestLegalAcceptances: legalAcceptances.map((row: any) => ({
        docType: String(row.docType),
        version: String(row.version),
        acceptedAt: row.acceptedAt.toISOString(),
        source: String(row.source ?? "clickwrap"),
      })),
    },
    sbom: {
      latestReports: sbomReports.map((row: any) => ({
        id: row.id,
        status: row.status,
        sha: row.sha ?? null,
        runId: row.runId ?? null,
        createdAt: row.createdAt.toISOString(),
        summary: row.summary ?? null,
      })),
      latestAt: toIso(sbomReports[0]?.createdAt),
      reportCount90d: sbomCount90d,
    },
    dast: {
      latestReports: dastReports.map((row: any) => ({
        id: row.id,
        status: row.status,
        runId: row.runId ?? null,
        createdAt: row.createdAt.toISOString(),
        summary: row.summary ?? null,
      })),
      findingsOpenBySeverity: summarizeDastFindingsBySeverity(dastFindingsOpen),
      latestAt: toIso(dastReports[0]?.createdAt),
      findingsTotal: dastFindingsOpen.length,
    },
    accessibility: {
      latestReport: {
        version: accessibilityLatest?.version ?? null,
        score: accessibilityLatest?.score ?? null,
        criticalViolations: Number(accessibilityLatest?.criticalViolations ?? 0),
        seriousViolations: Number(accessibilityLatest?.seriousViolations ?? 0),
        totalViolations: Number(accessibilityLatest?.totalViolations ?? 0),
        measuredAt: toIso(accessibilityLatest?.measuredAt),
      },
    },
    policies: {
      complianceControls: complianceControls.map((row: any) => ({
        key: row.key,
        domain: row.domain,
        title: row.title,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
      })),
      legalDocuments: legalDocs.map((row: any) => ({
        type: String(row.type),
        version: row.version,
        locale: row.locale,
        effectiveAt: row.effectiveAt.toISOString(),
        title: row.title,
      })),
    },
  };

  const sectionHashes = buildSectionHashes(payloadBase);
  const payloadHash = hashEvidencePayload(payloadBase);

  return {
    ...payloadBase,
    evidenceManifest: {
      sectionHashes,
      payloadHash,
    },
  };
}

export function signEnterpriseSecurityPack(
  payload: EnterpriseSecurityPackPayload,
  opts?: { zipHash?: string; pdfHash?: string; secret?: string },
): EnterpriseSecurityPackSigned {
  const manifest = {
    version: 1 as const,
    kind: "enterprise_security_pack" as const,
    generatedAt: payload.generatedAt,
    instanceId: payload.installation.instanceId,
    payloadHash: payload.evidenceManifest.payloadHash,
    sectionHashes: payload.evidenceManifest.sectionHashes,
    ...(opts?.zipHash ? { zipHash: opts.zipHash } : {}),
    ...(opts?.pdfHash ? { pdfHash: opts.pdfHash } : {}),
  };
  const signature = crypto
    .createHmac("sha256", opts?.secret ?? getSigningSecret())
    .update(stableStringify(manifest))
    .digest("hex");
  return { payload, manifest, signature, algorithm: "HMAC-SHA256" };
}

export function verifyEnterpriseSecurityPackSignature(bundle: EnterpriseSecurityPackSigned, secret?: string) {
  const expected = signEnterpriseSecurityPack(bundle.payload, {
    zipHash: bundle.manifest.zipHash,
    pdfHash: bundle.manifest.pdfHash,
    secret: secret ?? getSigningSecret(),
  });
  return expected.signature === bundle.signature && stableStringify(expected.manifest) === stableStringify(bundle.manifest);
}

function buildSimplePdf(lines: string[]) {
  const width = 595;
  const height = 842;
  const fontSize = 10;
  const lineHeight = 13;
  const marginLeft = 36;
  let y = height - 42;
  const pageOps: string[] = ["BT", `/F1 ${fontSize} Tf`, "0 0 0 rg"];
  for (const raw of lines) {
    if (y < 40) break;
    pageOps.push(`${marginLeft} ${y} Td (${escapePdfText(raw.slice(0, 140))}) Tj`);
    y -= lineHeight;
  }
  pageOps.push("ET");
  const stream = Buffer.from(pageOps.join("\n"), "utf8");

  const objects: Buffer[] = [];
  const pushObj = (id: number, body: string | Buffer) => {
    const header = Buffer.from(`${id} 0 obj\n`, "utf8");
    const footer = Buffer.from(`\nendobj\n`, "utf8");
    const bodyBuf = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
    objects[id] = Buffer.concat([header, bodyBuf, footer]);
  };

  pushObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  pushObj(2, "<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  pushObj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`);
  pushObj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pushObj(5, Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "utf8"), stream, Buffer.from("\nendstream", "utf8")]));

  let offset = 0;
  const chunks: Buffer[] = [];
  const offsets: number[] = [0];
  const header = Buffer.from("%PDF-1.4\n", "utf8");
  chunks.push(header);
  offset += header.length;
  for (let id = 1; id <= 5; id += 1) {
    offsets[id] = offset;
    chunks.push(objects[id]);
    offset += objects[id].length;
  }
  const xrefOffset = offset;
  const xrefLines = ["xref", `0 6`, "0000000000 65535 f "];
  for (let id = 1; id <= 5; id += 1) {
    xrefLines.push(`${String(offsets[id]).padStart(10, "0")} 00000 n `);
  }
  const xref = Buffer.from(`${xrefLines.join("\n")}\n`, "utf8");
  chunks.push(xref);
  const trailer = Buffer.from(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, "utf8");
  chunks.push(trailer);
  return Buffer.concat(chunks);
}

function escapePdfText(value: string) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

export function renderEnterpriseSecurityPackSummaryPdf(bundle: EnterpriseSecurityPackSigned) {
  const p = bundle.payload;
  const lines = [
    "ENTERPRISE SECURITY PROCUREMENT PACK (SUMMARY)",
    `Instance: ${p.installation.instanceId}`,
    `Client: ${p.installation.clientName ?? "-"}`,
    `Domain: ${p.installation.domain ?? "-"}`,
    `Version: ${p.installation.version ?? "-"} (${p.installation.releaseChannel ?? "-"})`,
    `Generated: ${p.generatedAt}`,
    "",
    "IAM",
    `SSO: ${String(p.iam.ssoEnabled ?? "-")} | MFA enforced: ${String(p.iam.mfaEnforced ?? "-")} | SCIM: ${String(p.iam.scimEnabled ?? "-")}`,
    `IAM last sync: ${p.iam.lastSyncAt ?? "-"}`,
    "",
    "Availability / Resilience",
    `SLO p95: ${p.slos.p95Ms ?? "-"} ms | errorRate: ${p.slos.errorRate ?? "-"} | webhookRetryRate: ${p.slos.webhookRetryRate ?? "-"}`,
    `Backups 30d: ${p.backups.recent30dCount} | last backup: ${p.backups.latestBackupAt ?? "-"}`,
    `Restore verifications 30d: ${p.backups.restoreVerifications30d} | last restore: ${p.backups.lastRestoreVerification.finishedAt ?? "-"}`,
    `DR drills 90d: ${p.disasterRecovery.drills90d} | last drill: ${p.disasterRecovery.lastDrillAt ?? "-"} (${p.disasterRecovery.lastDrillStatus ?? "-"})`,
    "",
    "Security Evidence",
    `Compliance evidence rows: ${p.audit.complianceEvidenceCount} | recent exported: ${p.audit.recentEvidence.length}`,
    `SBOM reports (90d): ${p.sbom.reportCount90d} | latest: ${p.sbom.latestAt ?? "-"}`,
    `DAST findings open total: ${p.dast.findingsTotal} | latest DAST: ${p.dast.latestAt ?? "-"}`,
    `Accessibility latest score: ${p.accessibility.latestReport.score ?? "-"} | critical: ${p.accessibility.latestReport.criticalViolations}`,
    `Policies exported: controls=${p.policies.complianceControls.length}, legalDocs=${p.policies.legalDocuments.length}`,
    "",
    `Manifest payload hash: ${p.evidenceManifest.payloadHash}`,
    `Signature (${bundle.algorithm}): ${bundle.signature}`,
  ];
  return buildSimplePdf(lines);
}

export function buildEnterpriseSecurityPackZip(bundle: EnterpriseSecurityPackSigned) {
  const json = Buffer.from(`${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return buildSingleFileZip(`enterprise-security-pack-${bundle.payload.installation.instanceId}.json`, json);
}

export async function generateAndStoreEnterpriseSecurityPack(prisma: AnyPrisma, installationId: string, actor: string) {
  const payload = await buildEnterpriseSecurityPackPayload(prisma, installationId);
  let signed = signEnterpriseSecurityPack(payload);
  let pdf = renderEnterpriseSecurityPackSummaryPdf(signed);
  let zip = buildEnterpriseSecurityPackZip(signed);
  let pdfHash = hashBinarySha256(pdf);
  let zipHash = hashBinarySha256(zip);
  signed = signEnterpriseSecurityPack(payload, { pdfHash, zipHash });
  pdf = renderEnterpriseSecurityPackSummaryPdf(signed);
  zip = buildEnterpriseSecurityPackZip(signed);
  pdfHash = hashBinarySha256(pdf);
  zipHash = hashBinarySha256(zip);
  signed = signEnterpriseSecurityPack(payload, { pdfHash, zipHash });

  const evidencePayload = {
    kind: "enterprise_security_pack",
    installationId,
    instanceId: payload.installation.instanceId,
    generatedAt: payload.generatedAt,
    manifest: signed.manifest,
    signature: signed.signature,
    algorithm: signed.algorithm,
    summary: {
      iam: payload.iam,
      slos: payload.slos,
      backups: {
        recent30dCount: payload.backups.recent30dCount,
        restoreVerifications30d: payload.backups.restoreVerifications30d,
        latestBackupStatus: payload.backups.latestBackupStatus,
      },
      security: {
        sbom90d: payload.sbom.reportCount90d,
        dastOpen: payload.dast.findingsTotal,
        accessibilityScore: payload.accessibility.latestReport.score,
      },
    },
  };

  const evidence = await prisma.complianceEvidence.create({
    data: {
      installationId,
      controlId: null,
      evidenceType: "enterprise_security_pack",
      source: "control-plane",
      payload: evidencePayload as any,
      payloadHash: hashEvidencePayload(evidencePayload),
      sourceCapturedAt: new Date(payload.generatedAt),
      capturedBy: actor,
      tags: ["security-pack", "procurement", "signed"],
    },
  });

  return {
    payload,
    signed,
    pdf,
    zip,
    pdfHash,
    zipHash,
    evidence,
    filenames: {
      zip: `enterprise-security-pack-${payload.installation.instanceId}-${payload.generatedAt.slice(0, 10)}.zip`,
      pdf: `enterprise-security-pack-summary-${payload.installation.instanceId}-${payload.generatedAt.slice(0, 10)}.pdf`,
    },
  };
}
