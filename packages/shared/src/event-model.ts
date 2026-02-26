export const EventNames = [
  "OrderCreated",
  "CheckoutStarted",
  "ProductViewed",
  "AddToCart",
  "PurchaseCompleted",
  "CartUpdated",
  "EmailSent",
  "PromoApplied",
  "FeatureUsageEvent",
  "BotCommand",
  "AgentHeartbeat",
  "DashboardViewed",
  "FraudScored",
  "FraudAlertRaised",
  "FraudReviewUpdated",
  "OnboardingStepCompleted",
  "TourStarted",
  "TourCompleted",
  "TourAbandoned",
] as const;

export type EventName = (typeof EventNames)[number];

export type EventEnvelope = {
  id: string;
  name: EventName;
  schemaVersion: number;
  occurredAt: string;
  source: "storefront" | "admin" | "api" | "bot" | "agent";
  companyId?: string | null;
  subjectId?: string | null;
  payload: Record<string, unknown>;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

export function validateEvent(event: unknown) {
  if (!isRecord(event)) {
    return { ok: false, error: "event must be object" };
  }
  if (!event.id || typeof event.id !== "string") {
    return { ok: false, error: "id required" };
  }
  if (typeof event.name !== "string" || !(EventNames as readonly string[]).includes(event.name)) {
    return { ok: false, error: "invalid name" };
  }
  if (!event.schemaVersion || typeof event.schemaVersion !== "number") {
    return { ok: false, error: "schemaVersion required" };
  }
  if (!event.occurredAt || typeof event.occurredAt !== "string") {
    return { ok: false, error: "occurredAt required" };
  }
  if (!event.source || typeof event.source !== "string") {
    return { ok: false, error: "source required" };
  }
  if (!isRecord(event.payload)) {
    return { ok: false, error: "payload required" };
  }
  return { ok: true };
}
