import Link from "next/link";
import { prisma } from "../lib/prisma";
import { getAuthorizedPartnerByPortalCredentials } from "../lib/partner-auth";
import { parseBaDateRange } from "../lib/partner-program";
import { resolvePartnerCertificationStatus } from "../lib/partner-certification";
import { PartnerCertificationSection } from "./PartnerCertificationSection";

export const dynamic = "force-dynamic";

export default async function PartnerPortalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const partnerSlug = typeof sp.partner === "string" ? sp.partner : "";
  const token = typeof sp.token === "string" ? sp.token : "";
  const range = parseBaDateRange({
    from: typeof sp.from === "string" ? sp.from : null,
    to: typeof sp.to === "string" ? sp.to : null,
  });

  const partner =
    partnerSlug && token
      ? await getAuthorizedPartnerByPortalCredentials({ slug: partnerSlug, token })
      : null;

  const leads = partner
    ? await prisma.lead.findMany({
        where: { partnerId: partner.id, createdAt: { gte: range.fromUtc, lte: range.toUtc } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];
  const conversions = partner
    ? await prisma.conversion.findMany({
        where: { partnerId: partner.id, createdAt: { gte: range.fromUtc, lte: range.toUtc } },
        include: {
          referralLink: { select: { code: true } },
          billingAccount: { select: { instanceId: true, clientName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  const estimatedCommission = conversions.reduce((sum, item) => sum + (item.estimatedCommissionAmount ?? 0), 0);
  const [certRuns, certifications] = partner
    ? await Promise.all([
        prisma.partnerCertificationRun.findMany({
          where: { partnerId: partner.id },
          orderBy: { submittedAt: "desc" },
          take: 5,
        }),
        prisma.partnerCertification.findMany({
          where: { partnerId: partner.id },
          orderBy: { issuedAt: "desc" },
          take: 5,
        }),
      ])
    : [[], []];

  const defaultCertReport = JSON.stringify(
    {
      kitVersion: "partner-cert-kit-v1",
      executedAt: new Date().toISOString(),
      openapi: { passed: true, testsRun: 12, failures: 0, openapiVersion: "v1" },
      events: { passed: true, schemasChecked: 8, incompatibleSchemas: 0 },
      sandbox: { passed: true, scenariosRun: 4, failedScenarios: 0 },
      security: {
        checklist: [
          { id: "webhook-signature-validation", passed: true },
          { id: "idempotency-handling", passed: true },
          { id: "secret-storage-rotation", passed: true },
          { id: "least-privilege-scopes", passed: true },
          { id: "audit-logging-enabled", passed: true },
        ],
      },
      performance: {
        p95ApiMs: 320,
        p95WebhookProcessingMs: 650,
        checklist: [
          { id: "p95-api-under-500ms", passed: true },
          { id: "p95-webhook-processing-under-1000ms", passed: true },
          { id: "retry-backoff-implemented", passed: true },
          { id: "dlq-observable", passed: true },
        ],
      },
    },
    null,
    2,
  );

  return (
    <main>
      <h1>Partner Portal</h1>
      <p>Leads, conversiones y comisión estimada por partner.</p>

      <form method="GET" className="card" style={{ marginBottom: 16, display: "grid", gap: 8 }}>
        <label>
          Partner slug
          <input name="partner" defaultValue={partnerSlug} />
        </label>
        <label>
          Portal token
          <input name="token" defaultValue={token} />
        </label>
        <label>
          Desde (BA)
          <input type="date" name="from" defaultValue={range.from} />
        </label>
        <label>
          Hasta (BA)
          <input type="date" name="to" defaultValue={range.to} />
        </label>
        <button type="submit">Ver</button>
      </form>

      {!partner && (partnerSlug || token) && <p>Credenciales inválidas.</p>}

      {partner && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <p><strong>Partner:</strong> {partner.name} ({partner.slug})</p>
            <p><strong>Rango BA:</strong> {range.from} a {range.to}</p>
            <p><strong>Leads:</strong> {leads.length}</p>
            <p><strong>Conversiones:</strong> {conversions.length}</p>
            <p><strong>Comisión estimada:</strong> ARS {estimatedCommission.toFixed(2)}</p>
            <p>
              <Link
                href={`/api/partners/portal/export?partner=${encodeURIComponent(partner.slug)}&token=${encodeURIComponent(
                  token,
                )}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}
              >
                Exportar CSV
              </Link>
            </p>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h2>Leads</h2>
            <ul>
              {leads.map((lead) => (
                <li key={lead.id}>
                  {lead.createdAt.toISOString()} - {lead.status}
                  {lead.email ? ` - ${lead.email}` : ""}
                  {lead.utmSource ? ` - ${lead.utmSource}` : ""}
                  {Array.isArray(lead.fraudFlags) && lead.fraudFlags.length ? ` - flags: ${lead.fraudFlags.join("|")}` : ""}
                </li>
              ))}
              {leads.length === 0 && <li>Sin leads en el rango.</li>}
            </ul>
          </div>

          <div className="card">
            <h2>Conversiones</h2>
            <ul>
              {conversions.map((conv) => (
                <li key={conv.id}>
                  {conv.createdAt.toISOString()} - {conv.status}
                  {conv.billingAccount?.instanceId ? ` - ${conv.billingAccount.instanceId}` : ""}
                  {conv.referralLink?.code ? ` - ${conv.referralLink.code}` : ""}
                  {` - ARS ${Number(conv.estimatedCommissionAmount ?? 0).toFixed(2)}`}
                </li>
              ))}
              {conversions.length === 0 && <li>Sin conversiones en el rango.</li>}
            </ul>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h2>Certificación Partner</h2>
            <p>Últimas ejecuciones del Certification Test Kit y certificados emitidos.</p>
            <h3>Certificados</h3>
            <ul>
              {certifications.map((cert) => (
                <li key={cert.id}>
                  {cert.certificateNo} - {resolvePartnerCertificationStatus({ status: cert.status, expiresAt: cert.expiresAt })}
                  {" · "}
                  emitido {cert.issuedAt.toISOString().slice(0, 10)}
                  {" · "}
                  vence {cert.expiresAt.toISOString().slice(0, 10)}
                </li>
              ))}
              {certifications.length === 0 && <li>Sin certificaciones emitidas.</li>}
            </ul>
            <h3>Runs</h3>
            <ul>
              {certRuns.map((run) => (
                <li key={run.id}>
                  {run.submittedAt.toISOString()} - {run.status} - score {run.score} - kit {run.kitVersion}
                </li>
              ))}
              {certRuns.length === 0 && <li>Sin runs cargados.</li>}
            </ul>
          </div>

          <PartnerCertificationSection partnerSlug={partner.slug} token={token} defaultReportJson={defaultCertReport} />
        </>
      )}
    </main>
  );
}
