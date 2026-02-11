import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";

const databaseUrl = process.env.CONTROL_PLANE_DATABASE_URL;
const instanceId = process.env.DR_INSTANCE_ID;
const plan = process.env.DR_PLAN ?? "standard";
const rpoTargetMinEnv = process.env.DR_RPO_TARGET_MIN;
const rtoTargetMinEnv = process.env.DR_RTO_TARGET_MIN;

const planTargets = {
  starter: { rpo: 1440, rto: 480 },
  standard: { rpo: 720, rto: 240 },
  pro: { rpo: 240, rto: 120 },
  enterprise: { rpo: 60, rto: 60 },
};

if (!databaseUrl) {
  console.error("CONTROL_PLANE_DATABASE_URL is required");
  process.exit(1);
}

function run(command, args, env) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  if (result.status !== 0) {
    throw new Error(`${command} failed`);
  }
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function getInstallation() {
  if (instanceId) {
    return prisma.installation.findUnique({ where: { instanceId } });
  }
  return prisma.installation.findFirst({ orderBy: { lastHeartbeatAt: "desc" } });
}

async function getLastBackupAt(installationId) {
  const latest = await prisma.backupRecord.findFirst({
    where: { installationId },
    orderBy: { createdAt: "desc" },
  });
  return latest?.createdAt ?? null;
}

async function runDrill() {
  const installation = await getInstallation();
  if (!installation) {
    throw new Error("Installation not found");
  }

  const targets = planTargets[plan] ?? planTargets.standard;
  const rpoTargetMin = Number(rpoTargetMinEnv ?? installation.rpoTargetMin ?? targets.rpo);
  const rtoTargetMin = Number(rtoTargetMinEnv ?? installation.rtoTargetMin ?? targets.rto);

  const backupAt = installation.lastBackupAt ?? (await getLastBackupAt(installation.id));
  const now = new Date();
  const rpoMinutes = backupAt ? Math.max(0, Math.floor((now.getTime() - backupAt.getTime()) / 60000)) : null;

  const drill = await prisma.disasterRecoveryDrill.create({
    data: {
      installationId: installation.id,
      instanceId: installation.instanceId,
      status: "running",
      rpoMinutes,
    },
  });

  const start = Date.now();
  let status = "succeeded";
  let notes = null;

  try {
    run("node", ["scripts/restore.mjs"], {
      DATABASE_URL: process.env.DR_DATABASE_URL ?? process.env.DATABASE_URL,
      REDIS_URL: process.env.DR_REDIS_URL ?? process.env.REDIS_URL,
      BACKUP_ID: process.env.BACKUP_ID,
      BACKUP_PATH: process.env.BACKUP_PATH,
      BACKUP_DIR: process.env.BACKUP_DIR,
      BACKUP_ENCRYPTION_KEY: process.env.BACKUP_ENCRYPTION_KEY,
      REDIS_RESTORE: process.env.REDIS_RESTORE ?? "true",
    });
  } catch (error) {
    status = "failed";
    notes = error.message ?? "restore failed";
  }

  const rtoMinutes = Math.ceil((Date.now() - start) / 60000);

  await prisma.disasterRecoveryDrill.update({
    where: { id: drill.id },
    data: {
      status,
      rtoMinutes,
      finishedAt: new Date(),
      notes,
      meta: {
        backupAt: backupAt ? backupAt.toISOString() : null,
      },
    },
  });

  await prisma.installation.update({
    where: { id: installation.id },
    data: {
      drPlan: plan,
      rpoTargetMin,
      rtoTargetMin,
      lastDrillAt: new Date(),
      lastDrillStatus: status,
      lastDrillRpoMin: rpoMinutes ?? undefined,
      lastDrillRtoMin: rtoMinutes,
    },
  });

  if (rpoMinutes != null && rpoMinutes > rpoTargetMin) {
    await prisma.alert.create({
      data: {
        installationId: installation.id,
        level: "error",
        message: `DR RPO breach: ${rpoMinutes}m > ${rpoTargetMin}m`,
      },
    });
  }
  if (rtoMinutes > rtoTargetMin) {
    await prisma.alert.create({
      data: {
        installationId: installation.id,
        level: "error",
        message: `DR RTO breach: ${rtoMinutes}m > ${rtoTargetMin}m`,
      },
    });
  }

  console.log(`DR drill ${status}. RPO ${rpoMinutes ?? "-"}m / RTO ${rtoMinutes}m`);
}

runDrill()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
