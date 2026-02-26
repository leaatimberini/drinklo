import crypto from "crypto";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")} ]`.replace(", ]", "]");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`);
  return `{${entries.join(",")}}`;
}

export function signPayload(payload: unknown, secret: string) {
  const data = stableStringify(payload);
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}
