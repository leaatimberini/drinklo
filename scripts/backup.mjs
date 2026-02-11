import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://erp:erp@localhost:5432/erp?schema=public";
const redisUrl = process.env.REDIS_URL;
const backupRoot = process.env.BACKUP_DIR ?? "./backups";
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? 30);
const encryptKey = process.env.BACKUP_ENCRYPTION_KEY;
const includeRedis = process.env.BACKUP_REDIS !== "false";
const includeStorage = process.env.BACKUP_STORAGE !== "false";
const backupMetaPath = process.env.BACKUP_META_PATH ?? path.join(backupRoot, "last_backup.json");
const backupBucket = process.env.BACKUP_BUCKET ?? "";
const instanceId = process.env.INSTANCE_ID ?? "";

function timestampId() {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });
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

function encryptFile(filePath, key) {
  const data = fs.readFileSync(filePath);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]);
  const outPath = `${filePath}.enc`;
  fs.writeFileSync(outPath, payload);
  fs.unlinkSync(filePath);
  return outPath;
}

async function exportRedis(outDir) {
  if (!redisUrl) return null;
  const keysResult = spawnSync("redis-cli", ["-u", redisUrl, "--scan"], { encoding: "utf8" });
  if (keysResult.status !== 0) {
    throw new Error("redis-cli scan failed");
  }

  const keys = keysResult.stdout.split("\n").map((k) => k.trim()).filter(Boolean);
  const entries = [];

  for (const key of keys) {
    const dumpResult = spawnSync("redis-cli", ["-u", redisUrl, "--raw", "DUMP", key], { encoding: "buffer" });
    if (dumpResult.status !== 0) {
      continue;
    }
    const ttlResult = spawnSync("redis-cli", ["-u", redisUrl, "PTTL", key], { encoding: "utf8" });
    const ttl = Number((ttlResult.stdout ?? "").trim());
    const data = Buffer.from(dumpResult.stdout ?? Buffer.alloc(0));
    entries.push({ key, ttl: Number.isFinite(ttl) ? ttl : -1, value: data.toString("base64") });
  }

  const filePath = path.join(outDir, "redis.json");
  fs.writeFileSync(filePath, JSON.stringify({ exportedAt: new Date().toISOString(), keys: entries }, null, 2));
  return filePath;
}

async function exportStorageMetadata(outDir) {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) return null;

  const region = process.env.STORAGE_REGION ?? "us-east-1";
  const endpoint = process.env.STORAGE_ENDPOINT;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY ?? "";
  const secretAccessKey = process.env.STORAGE_SECRET_KEY ?? "";
  const forcePathStyle = process.env.STORAGE_FORCE_PATH_STYLE === "true";

  const client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  const objects = [];
  let continuationToken;
  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );
    for (const item of result.Contents ?? []) {
      objects.push({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified?.toISOString(),
        etag: item.ETag,
      });
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  const filePath = path.join(outDir, "storage-metadata.json");
  fs.writeFileSync(filePath, JSON.stringify({ bucket, exportedAt: new Date().toISOString(), objects }, null, 2));
  return filePath;
}

async function runBackup() {
  ensureDir(backupRoot);
  const id = timestampId();
  const outDir = path.join(backupRoot, id);
  ensureDir(outDir);

  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    encrypted: Boolean(encryptKey),
    files: [],
  };

  const pgPath = path.join(outDir, "postgres.dump");
  run("pg_dump", ["-Fc", databaseUrl, "-f", pgPath]);

  let redisFile = null;
  if (includeRedis && redisUrl) {
    redisFile = await exportRedis(outDir);
  }

  let storageFile = null;
  if (includeStorage) {
    storageFile = await exportStorageMetadata(outDir);
  }

  const files = [pgPath, redisFile, storageFile].filter(Boolean);
  let key;
  if (encryptKey) {
    key = deriveKey(encryptKey);
  }

  const finalFiles = [];
  for (const file of files) {
    const target = key ? encryptFile(file, key) : file;
    finalFiles.push(target);
  }

  for (const file of finalFiles) {
    const hash = await sha256File(file);
    const stat = fs.statSync(file);
    manifest.files.push({ name: path.basename(file), size: stat.size, sha256: hash });
  }

  const manifestPath = path.join(outDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const manifestHash = await sha256File(manifestPath);
  fs.writeFileSync(path.join(outDir, "manifest.sha256"), `${manifestHash}  manifest.json\n`);

  const totalSize = manifest.files.reduce((sum, file) => sum + (file.size ?? 0), 0);
  const backupMeta = {
    id,
    backupId: id,
    instanceId,
    createdAt: manifest.createdAt,
    lastBackupAt: manifest.createdAt,
    sizeBytes: totalSize,
    checksum: manifestHash,
    bucket: backupBucket || null,
    path: outDir,
  };
  fs.writeFileSync(backupMetaPath, JSON.stringify(backupMeta, null, 2));

  console.log(`Backup completed: ${outDir}`);

  if (retentionDays > 0) {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const entries = fs.readdirSync(backupRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(backupRoot, entry.name);
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < cutoff) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }
  }
}

runBackup().catch((error) => {
  console.error(error);
  process.exit(1);
});
