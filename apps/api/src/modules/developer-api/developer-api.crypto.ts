import crypto from "node:crypto";

const KEY_PREFIX = "dpk";

export function generateApiKeyMaterial() {
  const prefix = `${KEY_PREFIX}_${crypto.randomBytes(6).toString("hex")}`;
  const secret = crypto.randomBytes(24).toString("base64url");
  return {
    prefix,
    secret,
    fullKey: `${prefix}.${secret}`,
  };
}

export function hashApiKeySecret(secret: string) {
  const pepper = process.env.DEVELOPER_API_KEY_PEPPER ?? process.env.JWT_SECRET ?? "dev-pepper";
  return crypto.createHash("sha256").update(`${pepper}:${secret}`).digest("hex");
}

export function maskIp(ip?: string | null) {
  if (!ip) return null;
  const text = String(ip);
  if (text.includes(":")) {
    return text.split(":").slice(0, 3).join(":") + ":*";
  }
  const parts = text.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
  }
  return "*";
}

export function signDeveloperWebhook(secret: string, payload: string, timestamp: string) {
  const digest = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

export function verifyDeveloperWebhookSignature(
  secret: string,
  payload: string,
  signatureHeader?: string,
  toleranceSeconds = 300,
) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((chunk) => {
      const [key, value] = chunk.trim().split("=");
      return [key, value];
    }),
  );
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const now = Math.floor(Date.now() / 1000);
  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  const expected = signDeveloperWebhook(secret, payload, ts).split(",").find((item) => item.startsWith("v1="))?.slice(3);
  if (!expected || expected.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
