import crypto from "node:crypto";
import type { PrismaClient } from "./generated/prisma";
import { hashEvidencePayload, stableStringify } from "./compliance-evidence";
import { scoreActivationInstance } from "./activation-score";

type AnyPrisma = PrismaClient | any;

export type GoLiveReportPayload = {
  generatedAt: string;
  installation: {
    installationId: string;
    instanceId: string;
    clientName: string | null;
    domain: string | null;
    version: string | null;
    releaseChannel: string | null;
    healthStatus: string | null;
    lastHeartbeatAt: string | null;
  };
  slo: {
    target: {
      p95Ms: number | null;
      errorRate: number | null;
      webhookRetryRate: number | null;
      source: string;
    };
    observed: {
      p95Ms: number | null;
      errorRate: number | null;
      webhookRetryRate: number | null;
      measuredAt: string | null;
    };
  };
  backups: {
    latestBackupAt: string | null;
    latestBackupStatus: string | null;
    recentBackups: number;
    lastVerifiedRestore: { at: string | null; status: string | null; environment: string | null };
    restoreVerifications30d: number;
  };
  disasterRecovery: {
    lastDrillAt: string | null;
    lastDrillStatus: string | null;
    lastDrillRpoMin: number | null;
    lastDrillRtoMin: number | null;
    recentDrills30d: number;
  };
  integrationsHealth: {
    overallHealth: string | null;
    searchOk: boolean | null;
    integrationBuilder: {
      capturedAt: string | null;
      connectorsTotal: number;
      connectorsActive: number;
      deliveriesSuccess24h: number;
      deliveriesFailed24h: number;
      dlqOpen: number;
      health: "OK" | "WARN" | "FAIL" | "UNKNOWN";
    };
    billingProvider: { provider: string | null; status: string | null };
  };
  onboardingChecklist: {
    completed: number;
    total: number;
    progressPct: number;
    status: "NOT_ACTIVATED" | "ACTIVATING" | "ACTIVATED";
    items: Array<{
      key: string;
      label: string;
      completed: boolean;
      source: string;
      recommended: boolean;
    }>;
  };
  firstWeekMetrics: {
    window: { from: string | null; to: string | null; source: string };
    salesCountProxy: number;
    ordersCount: number;
    stockAlerts: number;
    featureUsageEvents: number;
    notes: string[];
  };
  evidenceSummary: {
    hashes: {
      payloadHash: string;
    };
  };
};

export type GoLiveSignedBundle = {
  payload: GoLiveReportPayload;
  manifest: {
    version: 1;
    kind: "go_live_report";
    generatedAt: string;
    instanceId: string;
    payloadHash: string;
    pdfHash?: string;
  };
  signature: string;
  algorithm: "HMAC-SHA256";
};

export async function buildGoLiveReportPayload(prisma: AnyPrisma, installationId: string): Promise<GoLiveReportPayload> {
  const installation = await prisma.installation.findUnique({
    where: { id: installationId },
  });
  if (!installation) {
    throw new Error("installation_not_found");
  }

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [billingAccount, latestIntegrationBuilder, backups30d, latestRestore, restores30d, latestDrill, drills30d, alerts90d, featureUsage45d, trialEvents] =
    await Promise.all([
      prisma.billingAccount.findUnique({
        where: { instanceId: installation.instanceId },
        include: { plan: true },
      }),
      prisma.integrationBuilderReport.findFirst({
        where: { installationId },
        orderBy: { capturedAt: "desc" },
      }),
      prisma.backupRecord.findMany({
        where: { installationId, createdAt: { gte: d30 } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.restoreVerification.findFirst({
        where: { installationId },
        orderBy: { finishedAt: "desc" },
      }),
      prisma.restoreVerification.count({
        where: { installationId, createdAt: { gte: d30 } },
      }),
      prisma.disasterRecoveryDrill.findFirst({
        where: { installationId },
        orderBy: { startedAt: "desc" },
      }),
      prisma.disasterRecoveryDrill.count({
        where: { installationId, startedAt: { gte: d30 } },
      }),
      prisma.alert.findMany({
        where: { installationId, createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.featureUsageSample.findMany({
        where: { installationId, capturedAt: { gte: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000) } },
        orderBy: { capturedAt: "desc" },
        take: 5000,
      }),
      prisma.trialLifecycleEvent.findMany({
        where: { installationId },
        orderBy: { eventAt: "asc" },
        take: 1000,
      }),
    ]);

  const activation = scoreActivationInstance({
    installationId,
    instanceId: installation.instanceId,
    clientName: installation.clientName,
    domain: installation.domain,
    healthStatus: installation.healthStatus,
    searchOk: installation.searchOk,
    billingAccountId: billingAccount?.id ?? null,
    planName: billingAccount?.plan?.name ?? null,
    provider: billingAccount?.provider ?? null,
    trialStartedAt:
      (trialEvents as any[]).find((evt) => String(evt.eventType) === "TrialStarted")?.eventAt ??
      billingAccount?.createdAt ??
      installation.createdAt,
    trialEndsAt: billingAccount?.trialEndsAt ?? null,
    monthlyOrders: billingAccount?.monthlyOrders ?? 0,
    monthlyGmvArs: billingAccount?.monthlyGmvArs ?? 0,
    trialEvents: (trialEvents as any[]).map((evt) => ({
      eventType: String(evt.eventType),
      eventAt: evt.eventAt,
      properties: evt.properties ?? null,
    })),
    featureUsage: (featureUsage45d as any[]).map((row) => ({
      feature: String(row.feature),
      action: String(row.action),
      count: Number(row.count ?? 0),
    })),
    recentPlaybookRuns: [],
  });

  const firstWeekWindow = resolveFirstWeekWindow({
    installationCreatedAt: installation.createdAt,
    trialEvents: trialEvents as any[],
    billingAccountCreatedAt: billingAccount?.createdAt ?? null,
    now,
  });
  const firstWeekFeatureUsage = (featureUsage45d as any[]).filter(
    (row) => row.capturedAt >= firstWeekWindow.from && row.capturedAt < firstWeekWindow.to,
  );
  const firstWeekAlerts = (alerts90d as any[]).filter(
    (row) => row.createdAt >= firstWeekWindow.from && row.createdAt < firstWeekWindow.to,
  );

  const firstWeekMetrics = buildFirstWeekMetrics({
    billingAccount,
    featureUsageRows: firstWeekFeatureUsage,
    alerts: firstWeekAlerts,
    window: firstWeekWindow,
  });

  const onboardingItems = mapActivationSignalsToOnboardingChecklist(activation.signals);
  const payload: GoLiveReportPayload = {
    generatedAt: now.toISOString(),
    installation: {
      installationId: installation.id,
      instanceId: installation.instanceId,
      clientName: installation.clientName ?? null,
      domain: installation.domain ?? null,
      version: installation.version ?? null,
      releaseChannel: installation.releaseChannel ?? null,
      healthStatus: installation.healthStatus ?? null,
      lastHeartbeatAt: installation.lastHeartbeatAt?.toISOString?.() ?? installation.lastSeenAt?.toISOString?.() ?? null,
    },
    slo: {
      target: {
        p95Ms: installation.sloP95Ms ?? null,
        errorRate: installation.sloErrorRate ?? null,
        webhookRetryRate: installation.sloWebhookRetryRate ?? null,
        source: installation.sloUpdatedAt ? "installation_reported" : "unavailable",
      },
      observed: {
        p95Ms: installation.sloP95Ms ?? null,
        errorRate: installation.sloErrorRate ?? null,
        webhookRetryRate: installation.sloWebhookRetryRate ?? null,
        measuredAt: installation.sloUpdatedAt?.toISOString?.() ?? null,
      },
    },
    backups: {
      latestBackupAt: installation.lastBackupAt?.toISOString?.() ?? backups30d[0]?.createdAt?.toISOString?.() ?? null,
      latestBackupStatus: installation.backupStatus ?? null,
      recentBackups: backups30d.length,
      lastVerifiedRestore: {
        at: latestRestore?.finishedAt?.toISOString?.() ?? latestRestore?.createdAt?.toISOString?.() ?? null,
        status: latestRestore?.status ?? null,
        environment: latestRestore?.environment ?? null,
      },
      restoreVerifications30d: restores30d,
    },
    disasterRecovery: {
      lastDrillAt: latestDrill?.startedAt?.toISOString?.() ?? installation.lastDrillAt?.toISOString?.() ?? null,
      lastDrillStatus: latestDrill?.status ?? installation.lastDrillStatus ?? null,
      lastDrillRpoMin: latestDrill?.rpoMinutes ?? installation.lastDrillRpoMin ?? null,
      lastDrillRtoMin: latestDrill?.rtoMinutes ?? installation.lastDrillRtoMin ?? null,
      recentDrills30d: drills30d,
    },
    integrationsHealth: {
      overallHealth: installation.healthStatus ?? null,
      searchOk: installation.searchOk ?? null,
      integrationBuilder: deriveIntegrationBuilderHealth(latestIntegrationBuilder),
      billingProvider: {
        provider: billingAccount?.provider ?? null,
        status: billingAccount?.status ?? null,
      },
    },
    onboardingChecklist: {
      completed: onboardingItems.filter((i) => i.completed).length,
      total: onboardingItems.length,
      progressPct: onboardingItems.length
        ? Math.round((onboardingItems.filter((i) => i.completed).length / onboardingItems.length) * 100)
        : 0,
      status: activation.state,
      items: onboardingItems,
    },
    firstWeekMetrics,
    evidenceSummary: {
      hashes: {
        payloadHash: "",
      },
    },
  };

  payload.evidenceSummary.hashes.payloadHash = hashEvidencePayload(payload);
  return payload;
}

export function signGoLiveReport(payload: GoLiveReportPayload, opts?: { pdfHash?: string; secret?: string }): GoLiveSignedBundle {
  const payloadHash = hashEvidencePayload(payload);
  const manifest = {
    version: 1 as const,
    kind: "go_live_report" as const,
    generatedAt: payload.generatedAt,
    instanceId: payload.installation.instanceId,
    payloadHash,
    ...(opts?.pdfHash ? { pdfHash: opts.pdfHash } : {}),
  };
  const secret = opts?.secret ?? getGoLiveSigningSecret();
  const signature = crypto.createHmac("sha256", secret).update(stableStringify(manifest)).digest("hex");
  return { payload, manifest, signature, algorithm: "HMAC-SHA256" };
}

export function verifyGoLiveReportSignature(bundle: GoLiveSignedBundle, secret?: string) {
  const expected = signGoLiveReport(bundle.payload, {
    pdfHash: bundle.manifest.pdfHash,
    secret: secret ?? getGoLiveSigningSecret(),
  });
  return expected.signature === bundle.signature;
}

export function hashBinarySha256(input: Buffer) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function renderGoLiveReportHtml(bundle: GoLiveSignedBundle) {
  const p = bundle.payload;
  const checklistRows = p.onboardingChecklist.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.completed ? "OK" : "Pending"}</td>
        <td>${escapeHtml(item.source)}</td>
      </tr>`,
    )
    .join("");

  const notes = p.firstWeekMetrics.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("");
  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
        h1 { margin: 0 0 8px; font-size: 24px; }
        h2 { margin: 20px 0 8px; font-size: 16px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        .meta, .small { color: #4b5563; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px; text-align: left; }
        th { background: #f9fafb; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
        .foot { margin-top: 18px; padding-top: 8px; border-top: 1px dashed #d1d5db; font-size: 10px; color: #6b7280; }
        ul { margin: 6px 0 0 16px; padding: 0; }
      </style>
    </head>
    <body>
      <h1>Go-Live Report</h1>
      <div class="meta">
        Instance: ${escapeHtml(p.installation.instanceId)} | Version: ${escapeHtml(p.installation.version ?? "-")} | Generated: ${new Date(p.generatedAt).toLocaleString()}
      </div>

      <div class="grid" style="margin-top:12px;">
        <div class="card">
          <strong>Installation</strong>
          <div class="small">Client: ${escapeHtml(p.installation.clientName ?? "-")}</div>
          <div class="small">Domain: ${escapeHtml(p.installation.domain ?? "-")}</div>
          <div class="small">Release channel: ${escapeHtml(p.installation.releaseChannel ?? "-")}</div>
          <div class="small">Health: ${escapeHtml(p.installation.healthStatus ?? "-")}</div>
        </div>
        <div class="card">
          <strong>SLO / Reliability</strong>
          <div class="small">p95 target/observed: ${fmtNum(p.slo.target.p95Ms)} ms</div>
          <div class="small">error rate target/observed: ${fmtPct(p.slo.target.errorRate)}</div>
          <div class="small">webhook retry rate target/observed: ${fmtPct(p.slo.target.webhookRetryRate)}</div>
          <div class="small">source: ${escapeHtml(p.slo.target.source)}</div>
        </div>
      </div>

      <h2>Backups & DR</h2>
      <table>
        <tr><th>Latest backup</th><td>${escapeHtml(p.backups.latestBackupAt ?? "-")}</td><th>Status</th><td>${escapeHtml(p.backups.latestBackupStatus ?? "-")}</td></tr>
        <tr><th>Backups (30d)</th><td>${p.backups.recentBackups}</td><th>Restore verifications (30d)</th><td>${p.backups.restoreVerifications30d}</td></tr>
        <tr><th>Last verified restore</th><td>${escapeHtml(p.backups.lastVerifiedRestore.at ?? "-")}</td><th>Env/Status</th><td>${escapeHtml(p.backups.lastVerifiedRestore.environment ?? "-")} / ${escapeHtml(p.backups.lastVerifiedRestore.status ?? "-")}</td></tr>
        <tr><th>Last DR drill</th><td>${escapeHtml(p.disasterRecovery.lastDrillAt ?? "-")}</td><th>Status</th><td>${escapeHtml(p.disasterRecovery.lastDrillStatus ?? "-")}</td></tr>
        <tr><th>DR RPO/RTO</th><td>${fmtNum(p.disasterRecovery.lastDrillRpoMin)} / ${fmtNum(p.disasterRecovery.lastDrillRtoMin)} min</td><th>Drills (30d)</th><td>${p.disasterRecovery.recentDrills30d}</td></tr>
      </table>

      <h2>Integrations Health</h2>
      <table>
        <tr><th>Overall</th><td>${escapeHtml(p.integrationsHealth.overallHealth ?? "-")}</td><th>Search</th><td>${p.integrationsHealth.searchOk == null ? "-" : p.integrationsHealth.searchOk ? "OK" : "FAIL"}</td></tr>
        <tr><th>Integration Builder</th><td>${p.integrationsHealth.integrationBuilder.health}</td><th>Captured at</th><td>${escapeHtml(p.integrationsHealth.integrationBuilder.capturedAt ?? "-")}</td></tr>
        <tr><th>Connectors</th><td>${p.integrationsHealth.integrationBuilder.connectorsActive}/${p.integrationsHealth.integrationBuilder.connectorsTotal}</td><th>DLQ Open</th><td>${p.integrationsHealth.integrationBuilder.dlqOpen}</td></tr>
        <tr><th>Deliveries 24h</th><td>${p.integrationsHealth.integrationBuilder.deliveriesSuccess24h} ok / ${p.integrationsHealth.integrationBuilder.deliveriesFailed24h} fail</td><th>Billing provider</th><td>${escapeHtml(p.integrationsHealth.billingProvider.provider ?? "-")} / ${escapeHtml(p.integrationsHealth.billingProvider.status ?? "-")}</td></tr>
      </table>

      <h2>Onboarding Checklist (derived)</h2>
      <div class="small">Status: ${p.onboardingChecklist.status} | Progress: ${p.onboardingChecklist.progressPct}% (${p.onboardingChecklist.completed}/${p.onboardingChecklist.total})</div>
      <table>
        <thead><tr><th>Task</th><th>Status</th><th>Source</th></tr></thead>
        <tbody>${checklistRows}</tbody>
      </table>

      <h2>First Week Metrics</h2>
      <table>
        <tr><th>Window</th><td>${escapeHtml(p.firstWeekMetrics.window.from ?? "-")} -> ${escapeHtml(p.firstWeekMetrics.window.to ?? "-")}</td><th>Source</th><td>${escapeHtml(p.firstWeekMetrics.window.source)}</td></tr>
        <tr><th>Sales (proxy)</th><td>${p.firstWeekMetrics.salesCountProxy}</td><th>Orders</th><td>${p.firstWeekMetrics.ordersCount}</td></tr>
        <tr><th>Stock alerts</th><td>${p.firstWeekMetrics.stockAlerts}</td><th>Feature events</th><td>${p.firstWeekMetrics.featureUsageEvents}</td></tr>
      </table>
      ${notes ? `<ul>${notes}</ul>` : ""}

      <div class="foot">
        Manifest hash: ${escapeHtml(bundle.manifest.payloadHash)}<br/>
        ${bundle.manifest.pdfHash ? `PDF hash: ${escapeHtml(bundle.manifest.pdfHash)}<br/>` : ""}
        Signature (${bundle.algorithm}): ${escapeHtml(bundle.signature)}
      </div>
    </body>
  </html>`;
}

export function renderGoLiveReportPdf(bundle: GoLiveSignedBundle) {
  const p = bundle.payload;
  const lines = [
    "GO-LIVE REPORT",
    `Instance: ${p.installation.instanceId}`,
    `Client: ${p.installation.clientName ?? "-"}`,
    `Domain: ${p.installation.domain ?? "-"}`,
    `Version: ${p.installation.version ?? "-"}`,
    `Release: ${p.installation.releaseChannel ?? "-"}`,
    `GeneratedAt: ${p.generatedAt}`,
    "",
    "SLO",
    `p95 target/observed(ms): ${fmtNum(p.slo.target.p95Ms)}`,
    `error rate target/observed: ${fmtPct(p.slo.target.errorRate)}`,
    `webhook retry rate: ${fmtPct(p.slo.target.webhookRetryRate)}`,
    `source: ${p.slo.target.source}`,
    "",
    "BACKUPS & DR",
    `latest backup: ${p.backups.latestBackupAt ?? "-"} (${p.backups.latestBackupStatus ?? "-"})`,
    `backups 30d: ${p.backups.recentBackups}`,
    `restore verifications 30d: ${p.backups.restoreVerifications30d}`,
    `last verified restore: ${p.backups.lastVerifiedRestore.at ?? "-"} (${p.backups.lastVerifiedRestore.environment ?? "-"} / ${p.backups.lastVerifiedRestore.status ?? "-"})`,
    `last DR drill: ${p.disasterRecovery.lastDrillAt ?? "-"} (${p.disasterRecovery.lastDrillStatus ?? "-"})`,
    `last DR RPO/RTO min: ${fmtNum(p.disasterRecovery.lastDrillRpoMin)} / ${fmtNum(p.disasterRecovery.lastDrillRtoMin)}`,
    "",
    "INTEGRATIONS HEALTH",
    `overall: ${p.integrationsHealth.overallHealth ?? "-"} | search: ${p.integrationsHealth.searchOk == null ? "-" : p.integrationsHealth.searchOk ? "OK" : "FAIL"}`,
    `integration-builder: ${p.integrationsHealth.integrationBuilder.health} active ${p.integrationsHealth.integrationBuilder.connectorsActive}/${p.integrationsHealth.integrationBuilder.connectorsTotal} dlq=${p.integrationsHealth.integrationBuilder.dlqOpen}`,
    `deliveries24h: ok=${p.integrationsHealth.integrationBuilder.deliveriesSuccess24h} fail=${p.integrationsHealth.integrationBuilder.deliveriesFailed24h}`,
    `billing provider: ${p.integrationsHealth.billingProvider.provider ?? "-"} / ${p.integrationsHealth.billingProvider.status ?? "-"}`,
    "",
    "ONBOARDING CHECKLIST (DERIVED)",
    `status: ${p.onboardingChecklist.status} progress=${p.onboardingChecklist.progressPct}% (${p.onboardingChecklist.completed}/${p.onboardingChecklist.total})`,
    ...p.onboardingChecklist.items.map((i) => `- [${i.completed ? "x" : " "}] ${i.label} (${i.source})`),
    "",
    "FIRST WEEK METRICS",
    `window: ${p.firstWeekMetrics.window.from ?? "-"} -> ${p.firstWeekMetrics.window.to ?? "-"} (${p.firstWeekMetrics.window.source})`,
    `sales(proxy): ${p.firstWeekMetrics.salesCountProxy} | orders: ${p.firstWeekMetrics.ordersCount} | stock alerts: ${p.firstWeekMetrics.stockAlerts}`,
    `feature usage events: ${p.firstWeekMetrics.featureUsageEvents}`,
    ...p.firstWeekMetrics.notes.map((n) => `note: ${n}`),
    "",
    "SIGNATURE",
    `manifest payload hash: ${bundle.manifest.payloadHash}`,
    ...(bundle.manifest.pdfHash ? [`pdf hash: ${bundle.manifest.pdfHash}`] : []),
    `signature (${bundle.algorithm}): ${bundle.signature}`,
  ];

  return buildSimplePdf(lines);
}

export async function generateAndStoreGoLiveReport(prisma: AnyPrisma, installationId: string, actor: string) {
  const payload = await buildGoLiveReportPayload(prisma, installationId);
  let signed = signGoLiveReport(payload);
  let pdf = renderGoLiveReportPdf(signed);
  let pdfHash = hashBinarySha256(pdf);
  signed = signGoLiveReport(payload, { pdfHash });
  pdf = renderGoLiveReportPdf(signed);
  const finalPdfHash = hashBinarySha256(pdf);
  if (finalPdfHash !== pdfHash) {
    pdfHash = finalPdfHash;
    signed = signGoLiveReport(payload, { pdfHash });
    pdf = renderGoLiveReportPdf(signed);
    pdfHash = hashBinarySha256(pdf);
  }

  const evidencePayload = {
    kind: "go_live_report",
    installationId,
    instanceId: payload.installation.instanceId,
    generatedAt: payload.generatedAt,
    manifest: signed.manifest,
    signature: signed.signature,
    algorithm: signed.algorithm,
    summary: {
      version: payload.installation.version,
      onboardingProgressPct: payload.onboardingChecklist.progressPct,
      onboardingStatus: payload.onboardingChecklist.status,
      firstWeekMetrics: payload.firstWeekMetrics,
    },
  };

  const evidence = await prisma.complianceEvidence.create({
    data: {
      installationId,
      controlId: null,
      evidenceType: "go_live_report",
      source: "control-plane",
      payload: evidencePayload as any,
      payloadHash: hashEvidencePayload(evidencePayload),
      sourceCapturedAt: new Date(payload.generatedAt),
      capturedBy: actor,
      tags: ["go-live", "pdf", "signed"],
    },
  });

  return {
    payload,
    signed,
    pdf,
    pdfHash,
    evidence,
    filename: `go-live-report-${payload.installation.instanceId}-${payload.generatedAt.slice(0, 10)}.pdf`,
  };
}

function mapActivationSignalsToOnboardingChecklist(
  signals: Array<{ key: string; label: string; detected: boolean; source: string }>,
) {
  const byKey = new Map(signals.map((s) => [s.key, s]));
  return [
    pickSignal(byKey, "catalog_imported", "Importar catálogo", true),
    pickSignal(byKey, "mercadopago_connected", "Configurar Mercado Pago", true),
    pickSignal(byKey, "first_sale", "Crear primera venta/pedido", true),
    pickSignal(byKey, "printing_ok", "Probar impresión/escáner", false),
    pickSignal(byKey, "first_route", "Configurar reparto / 1ra ruta", false),
    pickSignal(byKey, "first_email_campaign", "Lanzar primera campaña email", false),
  ];
}

function pickSignal(
  map: Map<string, { key: string; label: string; detected: boolean; source: string }>,
  key: string,
  label: string,
  recommended: boolean,
) {
  const sig = map.get(key);
  return {
    key,
    label,
    completed: Boolean(sig?.detected),
    source: sig?.source ?? "unknown",
    recommended,
  };
}

function resolveFirstWeekWindow(input: {
  installationCreatedAt: Date;
  billingAccountCreatedAt: Date | null;
  trialEvents: Array<{ eventType: string; eventAt: Date }>;
  now: Date;
}) {
  const trialStart = input.trialEvents.find((evt) => String(evt.eventType) === "TrialStarted")?.eventAt ?? null;
  const from = trialStart ?? input.billingAccountCreatedAt ?? input.installationCreatedAt;
  const to = new Date(Math.min(input.now.getTime(), from.getTime() + 7 * 24 * 60 * 60 * 1000));
  return { from, to, source: trialStart ? "trial_started" : input.billingAccountCreatedAt ? "billing_account_created" : "installation_created" };
}

function buildFirstWeekMetrics(input: {
  billingAccount: any;
  featureUsageRows: any[];
  alerts: any[];
  window: { from: Date; to: Date; source: string };
}) {
  let salesCountProxy = 0;
  let ordersCount = 0;
  let featureUsageEvents = 0;
  for (const row of input.featureUsageRows) {
    const feature = String(row.feature ?? "").toLowerCase();
    const action = String(row.action ?? "").toLowerCase();
    const count = Math.max(0, Number(row.count ?? 0));
    featureUsageEvents += count;
    if (feature === "pos" || feature === "sales" || action.includes("sale")) salesCountProxy += count;
    if (feature === "orders" || feature === "checkout" || action.includes("order")) ordersCount += count;
  }
  if (ordersCount === 0 && Number(input.billingAccount?.monthlyOrders ?? 0) > 0) {
    ordersCount = Math.min(Number(input.billingAccount.monthlyOrders), 999999);
  }
  const stockAlerts = input.alerts.filter((a) => /stock|inventario/i.test(String(a.message ?? ""))).length;
  const notes: string[] = [];
  if (salesCountProxy === 0) notes.push("Ventas primera semana estimadas por proxy de feature usage; no se detectaron eventos explícitos de ventas.");
  if (ordersCount === 0) notes.push("Órdenes primera semana sin señales; se usa 0 salvo fallback por billing usage.");
  if (stockAlerts === 0) notes.push("Sin alertas de stock detectadas en la ventana inicial.");

  return {
    window: {
      from: input.window.from.toISOString(),
      to: input.window.to.toISOString(),
      source: input.window.source,
    },
    salesCountProxy,
    ordersCount,
    stockAlerts,
    featureUsageEvents,
    notes,
  };
}

function deriveIntegrationBuilderHealth(row: any) {
  if (!row) {
    return {
      capturedAt: null,
      connectorsTotal: 0,
      connectorsActive: 0,
      deliveriesSuccess24h: 0,
      deliveriesFailed24h: 0,
      dlqOpen: 0,
      health: "UNKNOWN" as const,
    };
  }
  const failed = Number(row.deliveriesFailed24h ?? 0);
  const dlq = Number(row.dlqOpen ?? 0);
  const total = Number(row.connectorsTotal ?? 0);
  const active = Number(row.connectorsActive ?? 0);
  let health: "OK" | "WARN" | "FAIL" = "OK";
  if (failed > 50 || dlq > 25) health = "FAIL";
  else if (failed > 0 || dlq > 0 || active < total) health = "WARN";
  return {
    capturedAt: row.capturedAt?.toISOString?.() ?? null,
    connectorsTotal: total,
    connectorsActive: active,
    deliveriesSuccess24h: Number(row.deliveriesSuccess24h ?? 0),
    deliveriesFailed24h: failed,
    dlqOpen: dlq,
    health,
  };
}

function getGoLiveSigningSecret() {
  return process.env.GO_LIVE_REPORT_SIGNING_SECRET ?? process.env.SOC2_EVIDENCE_SIGNING_SECRET ?? process.env.CONTROL_PLANE_ADMIN_TOKEN ?? "go-live-dev-secret";
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtNum(value: number | null) {
  return value == null || !Number.isFinite(value) ? "-" : String(Math.round(value * 100) / 100);
}

function fmtPct(value: number | null) {
  return value == null || !Number.isFinite(value) ? "-" : `${(value * 100).toFixed(2)}%`;
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
  const xrefLines = ["xref", `0 ${6}`, "0000000000 65535 f "];
  for (let id = 1; id <= 5; id += 1) {
    xrefLines.push(`${String(offsets[id]).padStart(10, "0")} 00000 n `);
  }
  const xref = Buffer.from(`${xrefLines.join("\n")}\n`, "utf8");
  chunks.push(xref);
  offset += xref.length;
  const trailer = Buffer.from(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    "utf8",
  );
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
