import { hashEvidencePayload } from "./compliance-evidence";

export type DemoResetTarget = {
  id?: string | null;
  instanceId?: string | null;
  domain?: string | null;
  clientName?: string | null;
  releaseChannel?: string | null;
};

function containsDemoHint(value: string | null | undefined) {
  if (!value) return false;
  return /(demo|sandbox|trial-lab|staging-demo)/i.test(value);
}

export function isDemoResetEligibleInstallation(target: DemoResetTarget) {
  return (
    containsDemoHint(target.instanceId) ||
    containsDemoHint(target.domain) ||
    containsDemoHint(target.clientName) ||
    /^demo$/i.test(String(target.releaseChannel ?? ""))
  );
}

export function assertDemoResetAllowed(input: {
  target: DemoResetTarget | null | undefined;
  confirmText?: string | null;
}) {
  if (!input.target) throw new Error("installation_not_found");
  if (String(input.confirmText ?? "").trim().toUpperCase() !== "RESET DEMO") {
    throw new Error("confirmation_text_invalid");
  }
  if (!isDemoResetEligibleInstallation(input.target)) {
    throw new Error("installation_not_demo_eligible");
  }
  return true;
}

export function buildDemoResetEvidencePayload(input: {
  actor: string;
  target: DemoResetTarget;
  endpoint: string;
  responseStatus: number;
  responsePayload?: unknown;
  createdAt?: string;
}) {
  const payload = {
    kind: "demo_reset",
    actor: input.actor,
    instanceId: input.target.instanceId ?? null,
    domain: input.target.domain ?? null,
    clientName: input.target.clientName ?? null,
    endpoint: input.endpoint,
    responseStatus: input.responseStatus,
    responsePayload: input.responsePayload ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  return {
    payload,
    payloadHash: hashEvidencePayload(payload),
  };
}
