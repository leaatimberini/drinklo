import crypto from "crypto";

export function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")} ]`.replace(", ]", "]");
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${entries.join(",")}}`;
}

export function signPayload(payload: any, secret: string) {
  const data = stableStringify(payload);
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}
