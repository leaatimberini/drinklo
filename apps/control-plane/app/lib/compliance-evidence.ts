import crypto from "node:crypto";
import { prisma } from "./prisma";

export type ControlTemplate = {
  key: string;
  domain: "SECURITY" | "AVAILABILITY" | "CONFIDENTIALITY";
  title: string;
  description: string;
};

export const SOC2_CONTROL_TEMPLATES: ControlTemplate[] = [
  {
    key: "CC6.1_ACCESS_MFA",
    domain: "SECURITY",
    title: "Access protection and MFA",
    description: "Admin and privileged access should enforce MFA and monitored authentication.",
  },
  {
    key: "CC7.2_RELEASE_INTEGRITY",
    domain: "SECURITY",
    title: "Release integrity and change control",
    description: "Releases should include SBOM and tracked deployment artifacts.",
  },
  {
    key: "A1.2_BACKUP_DR",
    domain: "AVAILABILITY",
    title: "Backups and disaster recovery drills",
    description: "Backup cadence and restore/DR drills should be executed and evidenced.",
  },
  {
    key: "A1.3_SERVICE_SLOS",
    domain: "AVAILABILITY",
    title: "Service level objective monitoring",
    description: "Service availability and reliability metrics should be measured and reviewed.",
  },
  {
    key: "C1.1_CONFIDENTIALITY_LOGS",
    domain: "CONFIDENTIALITY",
    title: "Confidentiality and access evidence",
    description: "Access logs and privileged operations must be auditable with tamper-evident evidence.",
  },
];

export function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function hashEvidencePayload(payload: unknown) {
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function crc32(buffer: Buffer) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buffer.length; i += 1) {
    let c = (crc ^ buffer[i]) & 0xff;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ -1) >>> 0;
}

export function buildSingleFileZip(filename: string, content: Buffer) {
  const nameBuffer = Buffer.from(filename, "utf8");
  const crc = crc32(content);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(content.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(content.length, 20);
  centralHeader.writeUInt32LE(content.length, 24);
  centralHeader.writeUInt16LE(nameBuffer.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(1, 8);
  endRecord.writeUInt16LE(1, 10);
  const centralSize = centralHeader.length + nameBuffer.length;
  endRecord.writeUInt32LE(centralSize, 12);
  const centralOffset = localHeader.length + nameBuffer.length + content.length;
  endRecord.writeUInt32LE(centralOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([
    localHeader,
    nameBuffer,
    content,
    centralHeader,
    nameBuffer,
    endRecord,
  ]);
}

function signAuditPackage(payload: unknown) {
  const secret = process.env.SOC2_EVIDENCE_SIGNING_SECRET ?? process.env.CONTROL_PLANE_ADMIN_TOKEN ?? "soc2-dev-secret";
  return crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
}

async function ensureControlsSeeded() {
  for (const control of SOC2_CONTROL_TEMPLATES) {
    await prisma.complianceControl.upsert({
      where: { key: control.key },
      create: {
        key: control.key,
        domain: control.domain,
        title: control.title,
        description: control.description,
      },
      update: {
        domain: control.domain,
        title: control.title,
        description: control.description,
      },
    });
  }
}

async function controlByKey(key: string) {
  return prisma.complianceControl.findUnique({ where: { key } });
}

export async function collectComplianceEvidence(actor: string = "system") {
  await ensureControlsSeeded();

  const now = new Date();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [latestRelease, sbomReports, backupRecords, drDrills, installs] = await Promise.all([
    prisma.releaseManifest.findMany({ orderBy: { releasedAt: "desc" }, take: 20 }),
    prisma.securityReport.findMany({ where: { kind: { in: ["sbom", "SBOM"] } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.backupRecord.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.disasterRecoveryDrill.findMany({ orderBy: { startedAt: "desc" }, take: 50 }),
    prisma.installation.findMany({
      select: {
        id: true,
        instanceId: true,
        iamMfaEnforced: true,
        sloP95Ms: true,
        sloErrorRate: true,
        sloWebhookRetryRate: true,
        sloUpdatedAt: true,
      },
    }),
  ]);

  const accessLogs = await prisma.pluginJob.count({ where: { createdAt: { gte: since } } });

  const evidenceRows = [
    {
      controlKey: "CC7.2_RELEASE_INTEGRITY",
      evidenceType: "releases",
      source: "release_manifest",
      payload: {
        count: latestRelease.length,
        latest: latestRelease[0]
          ? { version: latestRelease[0].version, sha: latestRelease[0].sha, releasedAt: latestRelease[0].releasedAt }
          : null,
      },
      sourceCapturedAt: latestRelease[0]?.releasedAt ?? now,
      tags: ["security", "release"],
    },
    {
      controlKey: "CC7.2_RELEASE_INTEGRITY",
      evidenceType: "sbom",
      source: "security_report",
      payload: {
        count: sbomReports.length,
        latestAt: sbomReports[0]?.createdAt ?? null,
      },
      sourceCapturedAt: sbomReports[0]?.createdAt ?? now,
      tags: ["security", "sbom"],
    },
    {
      controlKey: "A1.2_BACKUP_DR",
      evidenceType: "backups",
      source: "backup_record",
      payload: {
        count: backupRecords.length,
        lastBackupAt: backupRecords[0]?.createdAt ?? null,
      },
      sourceCapturedAt: backupRecords[0]?.createdAt ?? now,
      tags: ["availability", "backup"],
    },
    {
      controlKey: "A1.2_BACKUP_DR",
      evidenceType: "dr_drills",
      source: "dr_drill",
      payload: {
        count: drDrills.length,
        lastDrillAt: drDrills[0]?.startedAt ?? null,
      },
      sourceCapturedAt: drDrills[0]?.startedAt ?? now,
      tags: ["availability", "dr"],
    },
    {
      controlKey: "CC6.1_ACCESS_MFA",
      evidenceType: "mfa_enforced",
      source: "installation",
      payload: {
        total: installs.length,
        enforced: installs.filter((item) => item.iamMfaEnforced).length,
      },
      sourceCapturedAt: now,
      tags: ["security", "mfa"],
    },
    {
      controlKey: "A1.3_SERVICE_SLOS",
      evidenceType: "slos",
      source: "installation",
      payload: {
        total: installs.length,
        samples: installs
          .filter((item) => item.sloUpdatedAt)
          .slice(0, 50)
          .map((item) => ({
            instanceId: item.instanceId,
            p95: item.sloP95Ms,
            errorRate: item.sloErrorRate,
            webhookRetryRate: item.sloWebhookRetryRate,
            updatedAt: item.sloUpdatedAt,
          })),
      },
      sourceCapturedAt: now,
      tags: ["availability", "slo"],
    },
    {
      controlKey: "C1.1_CONFIDENTIALITY_LOGS",
      evidenceType: "access_logs",
      source: "plugin_jobs",
      payload: {
        periodDays: 30,
        privilegedActions: accessLogs,
      },
      sourceCapturedAt: now,
      tags: ["confidentiality", "access"],
    },
  ];

  const created = [] as Array<{ id: string; controlKey: string; evidenceType: string; payloadHash: string }>;

  for (const row of evidenceRows) {
    const control = await controlByKey(row.controlKey);
    const payloadHash = hashEvidencePayload(row.payload);
    const evidence = await prisma.complianceEvidence.create({
      data: {
        controlId: control?.id ?? null,
        evidenceType: row.evidenceType,
        source: row.source,
        payload: row.payload as any,
        payloadHash,
        sourceCapturedAt: row.sourceCapturedAt,
        capturedBy: actor,
        tags: row.tags,
      },
      include: {
        control: {
          select: { key: true },
        },
      },
    });
    created.push({ id: evidence.id, controlKey: evidence.control?.key ?? row.controlKey, evidenceType: evidence.evidenceType, payloadHash });
  }

  return {
    collectedAt: now,
    count: created.length,
    items: created,
  };
}

export async function listEvidence(limit = 200) {
  return prisma.complianceEvidence.findMany({
    orderBy: { capturedAt: "desc" },
    take: Math.min(1000, Math.max(1, limit)),
    include: {
      control: {
        select: {
          key: true,
          domain: true,
          title: true,
          status: true,
        },
      },
      installation: {
        select: {
          id: true,
          instanceId: true,
          domain: true,
        },
      },
    },
  });
}

export async function listControls() {
  await ensureControlsSeeded();
  return prisma.complianceControl.findMany({
    orderBy: [{ domain: "asc" }, { key: "asc" }],
  });
}

export async function buildAuditPackage() {
  const [controls, evidence] = await Promise.all([listControls(), listEvidence(1000)]);
  const generatedAt = new Date();

  const payload = {
    generatedAt,
    framework: "SOC2 Readiness",
    disclaimer: "Readiness evidence package. This does not represent SOC2 certification.",
    controls,
    evidence,
  };

  const signature = signAuditPackage(payload);
  const signedPayload = {
    ...payload,
    signature,
    signatureAlgorithm: "HMAC-SHA256",
  };

  const json = Buffer.from(`${JSON.stringify(signedPayload, null, 2)}\n`, "utf8");
  const zip = buildSingleFileZip("audit-package.json", json);

  return {
    generatedAt,
    signature,
    filename: `soc2-audit-package-${generatedAt.toISOString().slice(0, 10)}.zip`,
    zip,
  };
}
