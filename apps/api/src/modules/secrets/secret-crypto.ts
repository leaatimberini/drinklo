import crypto from "node:crypto";

type EncryptedPayload = {
  encData: string;
  encDataIv: string;
  encDataTag: string;
  encKey: string;
  encKeyIv: string;
  encKeyTag: string;
  alg: string;
  keyVersion: number;
};

function loadMasterKey() {
  const raw = process.env.SECRETS_MASTER_KEY ?? "";
  if (!raw) {
    throw new Error("SECRETS_MASTER_KEY is required");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("SECRETS_MASTER_KEY must be 32 bytes base64");
  }
  return buf;
}

export function encryptSecret(plaintext: string): EncryptedPayload {
  const masterKey = loadMasterKey();
  const dataKey = crypto.randomBytes(32);
  const dataIv = crypto.randomBytes(12);
  const dataCipher = crypto.createCipheriv("aes-256-gcm", dataKey, dataIv);
  const dataEncrypted = Buffer.concat([dataCipher.update(plaintext, "utf8"), dataCipher.final()]);
  const dataTag = dataCipher.getAuthTag();

  const keyIv = crypto.randomBytes(12);
  const keyCipher = crypto.createCipheriv("aes-256-gcm", masterKey, keyIv);
  const keyEncrypted = Buffer.concat([keyCipher.update(dataKey), keyCipher.final()]);
  const keyTag = keyCipher.getAuthTag();

  return {
    encData: dataEncrypted.toString("base64"),
    encDataIv: dataIv.toString("base64"),
    encDataTag: dataTag.toString("base64"),
    encKey: keyEncrypted.toString("base64"),
    encKeyIv: keyIv.toString("base64"),
    encKeyTag: keyTag.toString("base64"),
    alg: "AES-256-GCM",
    keyVersion: 1,
  };
}

export function decryptSecret(payload: EncryptedPayload) {
  const masterKey = loadMasterKey();
  const keyIv = Buffer.from(payload.encKeyIv, "base64");
  const keyCipher = crypto.createDecipheriv("aes-256-gcm", masterKey, keyIv);
  keyCipher.setAuthTag(Buffer.from(payload.encKeyTag, "base64"));
  const dataKey = Buffer.concat([
    keyCipher.update(Buffer.from(payload.encKey, "base64")),
    keyCipher.final(),
  ]);

  const dataIv = Buffer.from(payload.encDataIv, "base64");
  const dataCipher = crypto.createDecipheriv("aes-256-gcm", dataKey, dataIv);
  dataCipher.setAuthTag(Buffer.from(payload.encDataTag, "base64"));
  const plaintext = Buffer.concat([
    dataCipher.update(Buffer.from(payload.encData, "base64")),
    dataCipher.final(),
  ]).toString("utf8");
  return plaintext;
}

export type { EncryptedPayload };
