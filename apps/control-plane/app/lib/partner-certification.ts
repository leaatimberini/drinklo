import crypto from "node:crypto";
import { stableStringify } from "./plugin-marketplace";

export const PARTNER_CERT_KIT_VERSION = "partner-cert-kit-v1";
export const PARTNER_CERT_VALIDITY_DAYS = 180;

export type PartnerCertificationTestKit = ReturnType<typeof buildPartnerCertificationTestKit>;

export type CertificationValidationResult = {
  passed: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  summary: {
    openapiPassed: boolean;
    eventsPassed: boolean;
    sandboxPassed: boolean;
    securityPassed: boolean;
    performancePassed: boolean;
  };
};

export function buildPartnerCertificationTestKit() {
  return {
    version: PARTNER_CERT_KIT_VERSION,
    generatedAt: new Date().toISOString(),
    contractualTests: {
      openapi: {
        description: "Run OpenAPI contract tests against public API endpoints",
        sources: [
          "/developer-portal/openapi",
          "packages/docs/DEVELOPER_API.md",
          "packages/docs/CONTRACT_TESTING.md",
        ],
        minimum: {
          testsRun: 10,
          failures: 0,
        },
      },
      events: {
        description: "Validate canonical event schema compatibility and sample payloads",
        sources: ["packages/docs/EVENT_MODEL.md"],
        minimum: {
          schemasChecked: 5,
          incompatibleSchemas: 0,
        },
      },
    },
    sandboxHarness: {
      description: "Execute sandbox integration harness against deterministic mocks",
      sources: ["packages/docs/SANDBOX.md"],
      commandHints: ["pnpm sandbox:harness", "pnpm sandbox:harness:all"],
      minimum: {
        scenariosRun: 3,
        failedScenarios: 0,
      },
    },
    checklists: {
      security: [
        "webhook-signature-validation",
        "idempotency-handling",
        "secret-storage-rotation",
        "least-privilege-scopes",
        "audit-logging-enabled",
      ],
      performance: [
        "p95-api-under-500ms",
        "p95-webhook-processing-under-1000ms",
        "retry-backoff-implemented",
        "dlq-observable",
      ],
    },
    signing: {
      algorithm: "HMAC-SHA256",
      payload: "Stable JSON string of report payload",
      note: "Use partner portal token as HMAC secret for signed upload",
    },
  };
}

export function hashCertificationPayload(payload: unknown) {
  return crypto.createHash("sha256").update(stableStringify(payload as any)).digest("hex");
}

export function signCertificationReport(reportPayload: unknown, portalToken: string) {
  return crypto.createHmac("sha256", portalToken).update(stableStringify(reportPayload as any)).digest("hex");
}

export function verifyCertificationReportSignature(reportPayload: unknown, signature: string, portalToken: string) {
  if (!portalToken || !signature) return false;
  const expected = signCertificationReport(reportPayload, portalToken);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validatePartnerCertificationReport(report: unknown): CertificationValidationResult {
  const kit = buildPartnerCertificationTestKit();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(report)) {
    return {
      passed: false,
      score: 0,
      errors: ["report must be an object"],
      warnings: [],
      summary: {
        openapiPassed: false,
        eventsPassed: false,
        sandboxPassed: false,
        securityPassed: false,
        performancePassed: false,
      },
    };
  }

  const kitVersion = String(report.kitVersion ?? "");
  if (kitVersion !== kit.version) {
    errors.push(`kitVersion mismatch: expected ${kit.version}`);
  }

  const openapi = isObject(report.openapi) ? report.openapi : null;
  const events = isObject(report.events) ? report.events : null;
  const sandbox = isObject(report.sandbox) ? report.sandbox : null;
  const security = isObject(report.security) ? report.security : null;
  const performance = isObject(report.performance) ? report.performance : null;

  if (!openapi) errors.push("openapi section is required");
  if (!events) errors.push("events section is required");
  if (!sandbox) errors.push("sandbox section is required");
  if (!security) errors.push("security section is required");
  if (!performance) errors.push("performance section is required");

  const openapiPassed = Boolean(
    openapi &&
      Number(openapi.testsRun ?? 0) >= kit.contractualTests.openapi.minimum.testsRun &&
      Number(openapi.failures ?? 0) <= kit.contractualTests.openapi.minimum.failures &&
      openapi.passed === true,
  );
  if (openapi && !openapiPassed) errors.push("openapi contractual tests did not meet minimums");

  const eventsPassed = Boolean(
    events &&
      Number(events.schemasChecked ?? 0) >= kit.contractualTests.events.minimum.schemasChecked &&
      Number(events.incompatibleSchemas ?? 0) <= kit.contractualTests.events.minimum.incompatibleSchemas &&
      events.passed === true,
  );
  if (events && !eventsPassed) errors.push("event contract tests did not meet minimums");

  const sandboxPassed = Boolean(
    sandbox &&
      Number(sandbox.scenariosRun ?? 0) >= kit.sandboxHarness.minimum.scenariosRun &&
      Number(sandbox.failedScenarios ?? 0) <= kit.sandboxHarness.minimum.failedScenarios &&
      sandbox.passed === true,
  );
  if (sandbox && !sandboxPassed) errors.push("sandbox harness did not meet minimums");

  const securityChecklist = Array.isArray(security?.checklist)
    ? security!.checklist.map((item: any) => ({
        id: String(item?.id ?? ""),
        passed: item?.passed === true,
      }))
    : [];
  const missingSecurity = kit.checklists.security.filter(
    (id) => !securityChecklist.find((x) => x.id === id && x.passed),
  );
  const securityPassed = Boolean(security && missingSecurity.length === 0);
  if (security && missingSecurity.length > 0) errors.push(`security checklist missing: ${missingSecurity.join(", ")}`);

  const p95ApiMs = Number(performance?.p95ApiMs ?? Number.NaN);
  const p95WebhookMs = Number(performance?.p95WebhookProcessingMs ?? Number.NaN);
  const performanceChecklist = Array.isArray(performance?.checklist)
    ? performance!.checklist.map((item: any) => ({ id: String(item?.id ?? ""), passed: item?.passed === true }))
    : [];
  const missingPerfChecklist = kit.checklists.performance.filter(
    (id) => !performanceChecklist.find((x) => x.id === id && x.passed),
  );
  const perfThresholdPass =
    Number.isFinite(p95ApiMs) &&
    Number.isFinite(p95WebhookMs) &&
    p95ApiMs <= 500 &&
    p95WebhookMs <= 1000;
  const performancePassed = Boolean(performance && perfThresholdPass && missingPerfChecklist.length === 0);
  if (performance && !perfThresholdPass) errors.push("performance thresholds not met");
  if (performance && missingPerfChecklist.length > 0) {
    warnings.push(`performance checklist incomplete: ${missingPerfChecklist.join(", ")}`);
    errors.push("performance checklist requirements not met");
  }

  let score = 0;
  score += openapiPassed ? 20 : 0;
  score += eventsPassed ? 20 : 0;
  score += sandboxPassed ? 20 : 0;
  score += securityPassed ? 20 : 0;
  score += performancePassed ? 20 : 0;

  return {
    passed: errors.length === 0,
    score,
    errors,
    warnings,
    summary: {
      openapiPassed,
      eventsPassed,
      sandboxPassed,
      securityPassed,
      performancePassed,
    },
  };
}

export function computePartnerCertificationExpiry(baseDate = new Date(), validityDays = PARTNER_CERT_VALIDITY_DAYS) {
  return new Date(baseDate.getTime() + Math.max(1, validityDays) * 24 * 60 * 60 * 1000);
}

export function resolvePartnerCertificationStatus(input: {
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | string;
  expiresAt: Date | string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const expiresAt = input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
  if (String(input.status) === "REVOKED") return "REVOKED" as const;
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) return "EXPIRED" as const;
  return "ACTIVE" as const;
}

export function generateCertificateNumber(partnerSlug: string, date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  const slug = (partnerSlug || "partner").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8) || "PARTNER";
  return `PC-${ymd}-${slug}-${rand}`;
}

