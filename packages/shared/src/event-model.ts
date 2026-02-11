export const EventNames = [
  "OrderCreated",
  "CheckoutStarted",
  "ProductViewed",
  "CartUpdated",
  "EmailSent",
  "PromoApplied",
  "BotCommand",
  "AgentHeartbeat",
  "DashboardViewed",
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
  payload: Record<string, any>;
};

export function validateEvent(event: any) {
  if (!event || typeof event !== "object") {
    return { ok: false, error: "event must be object" };
  }
  if (!event.id || typeof event.id !== "string") {
    return { ok: false, error: "id required" };
  }
  if (!event.name || !EventNames.includes(event.name)) {
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
  if (!event.payload || typeof event.payload !== "object") {
    return { ok: false, error: "payload required" };
  }
  return { ok: true };
}
