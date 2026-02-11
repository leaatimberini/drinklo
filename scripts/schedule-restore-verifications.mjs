import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.CONTROL_PLANE_DATABASE_URL;
const count = Number(process.env.RESTORE_VERIFY_COUNT ?? 5);
const environment = process.env.RESTORE_VERIFY_ENV ?? "staging";

if (!databaseUrl) {
  console.error("CONTROL_PLANE_DATABASE_URL is required");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function run() {
  const installations = await prisma.installation.findMany({
    orderBy: { lastHeartbeatAt: "desc" },
    take: count,
  });
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let created = 0;

  for (const inst of installations) {
    const recent = await prisma.restoreVerification.findFirst({
      where: {
        installationId: inst.id,
        environment,
        scheduledAt: { gt: sevenDaysAgo },
      },
    });
    if (recent) continue;
    await prisma.restoreVerification.create({
      data: {
        installationId: inst.id,
        instanceId: inst.instanceId,
        environment,
        status: "scheduled",
      },
    });
    created += 1;
  }

  console.log(`Scheduled ${created} restore verifications for ${environment}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
