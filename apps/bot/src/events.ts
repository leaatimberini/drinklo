import { randomUUID } from "node:crypto";
import type { EventEnvelope, EventName } from "@erp/shared/event-model";

const SCHEMA_VERSION = 1;

function buildId() {
  try {
    return randomUUID();
  } catch {
    return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export async function emitEvent(
  apiUrl: string,
  name: EventName,
  payload: Record<string, any>,
  options?: { companyId?: string | null; subjectId?: string | null; token?: string },
) {
  const event: EventEnvelope = {
    id: buildId(),
    name,
    schemaVersion: SCHEMA_VERSION,
    occurredAt: new Date().toISOString(),
    source: "bot",
    companyId: options?.companyId ?? null,
    subjectId: options?.subjectId ?? null,
    payload,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options?.token) {
    headers["x-event-token"] = options.token;
  }

  try {
    await fetch(`${apiUrl}/events/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify([event]),
    });
  } catch {
    // best effort
  }
}
