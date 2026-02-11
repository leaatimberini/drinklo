import crypto from "node:crypto";

export function resolveAgentSecret(instanceId: string) {
  const secretMap = process.env.CONTROL_PLANE_AGENT_SECRETS;
  const globalSecret = process.env.CONTROL_PLANE_AGENT_TOKEN ?? "";
  let secret = globalSecret;
  if (secretMap) {
    try {
      const parsed = JSON.parse(secretMap) as Record<string, string>;
      secret = parsed[instanceId] ?? globalSecret;
    } catch {
      secret = globalSecret;
    }
  }
  return secret;
}

export function verifyAgentSignature(rawBody: string, signature: string, instanceId: string) {
  const secret = resolveAgentSecret(instanceId);
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
