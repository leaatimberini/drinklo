import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://erp:erp@localhost:5432/erp?schema=public";
const redisUrl = process.env.REDIS_URL;
const backupRoot = process.env.BACKUP_DIR ?? "./backups";
const backupId = process.env.BACKUP_ID;
const backupPath = process.env.BACKUP_PATH;
const encryptKey = process.env.BACKUP_ENCRYPTION_KEY;
const restoreRedis = process.env.REDIS_RESTORE === "true";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true, ...options });
  if (result.status !== 0) {
    throw new Error(`${command} failed`);
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  return new Promise((resolve, reject) => {
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function deriveKey(key) {
  return crypto.createHash("sha256").update(key).digest();
}

function decryptFile(filePath, key) {
  const data = fs.readFileSync(filePath);
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const outPath = filePath.replace(/\.enc$/, "");
  fs.writeFileSync(outPath, decrypted);
  return outPath;
}

async function validateManifest(dir) {
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("manifest.json not found");
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  for (const file of manifest.files) {
    const filePath = path.join(dir, file.name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing file ${file.name}`);
    }
    const hash = await sha256File(filePath);
    if (hash !== file.sha256) {
      throw new Error(`Hash mismatch for ${file.name}`);
    }
  }

  return manifest;
}

async function restoreRedisFromFile(filePath) {
  if (!redisUrl) return;
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const keys = payload.keys ?? [];

  run("redis-cli", ["-u", redisUrl, "FLUSHALL"]);

  for (const entry of keys) {
    const ttl = Number(entry.ttl ?? -1);
    const args = ["-u", redisUrl, "-x", "RESTORE", entry.key, String(ttl), "REPLACE"];
    const input = Buffer.from(entry.value, "base64");
    const result = spawnSync("redis-cli", args, { input, stdio: "inherit", shell: true });
    if (result.status !== 0) {
      throw new Error(`Redis restore failed for key ${entry.key}`);
    }
  }
}

async function runRestore() {
  const dir = backupPath
    ? path.dirname(backupPath)
    : backupId
      ? path.join(backupRoot, backupId)
      : null;

  if (!dir) {
    throw new Error("Set BACKUP_ID or BACKUP_PATH");
  }

  const manifest = await validateManifest(dir);
  const key = encryptKey ? deriveKey(encryptKey) : null;

  const tempDir = path.join(dir, "restore_tmp");
  if (key) {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    for (const file of manifest.files) {
      const filePath = path.join(dir, file.name);
      if (filePath.endsWith(".enc")) {
        const decrypted = decryptFile(filePath, key);
        const dest = path.join(tempDir, path.basename(decrypted));
        fs.renameSync(decrypted, dest);
      }
    }
  }

  const dataDir = key ? tempDir : dir;
  const pgDump = path.join(dataDir, "postgres.dump");
  if (!fs.existsSync(pgDump)) {
    throw new Error("postgres.dump not found");
  }

  run("pg_restore", ["--clean", "--if-exists", "-d", databaseUrl, pgDump]);

  const redisFile = path.join(dataDir, "redis.json");
  if (restoreRedis && fs.existsSync(redisFile)) {
    await restoreRedisFromFile(redisFile);
  }

  run("pnpm", ["-C", "packages/db", "prisma", "migrate", "diff", "--from-migrations", "--to-schema-datamodel", "--exit-code"]);
  run("pnpm", ["smoke"]);

  if (key && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log("Restore completed");
}

runRestore().catch((error) => {
  console.error(error);
  process.exit(1);
});
