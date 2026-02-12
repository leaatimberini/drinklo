import crypto from "node:crypto";

export function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}

export function verifyPluginReleaseSignature(payload: Record<string, any>, signature: string, secret: string) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function signPluginPayload(payload: Record<string, any>, secret: string) {
  return crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
}

export function verifyPublisherBundleSignature(payload: Record<string, any>, signature: string, signingSecret: string) {
  return verifyPluginReleaseSignature(payload, signature, signingSecret);
}
