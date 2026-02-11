import { prisma } from "./prisma";

export async function createPluginBatch(
  rolloutId: string,
  batchIndex: number,
  batchSize: number,
  channel: string,
  pluginName: string,
  version: string,
  action: string,
) {
  const installations = await prisma.installation.findMany({
    where: { releaseChannel: channel },
    orderBy: { createdAt: "asc" },
  });

  const start = batchIndex * batchSize;
  const slice = installations.slice(start, start + batchSize);
  if (slice.length === 0) {
    return { batch: null, created: 0 };
  }

  const batch = await prisma.pluginRolloutBatch.create({
    data: { rolloutId, batchIndex, status: "running" },
  });

  await prisma.pluginJob.createMany({
    data: slice.map((inst) => ({
      installationId: inst.id,
      instanceId: inst.instanceId,
      pluginName,
      version,
      action,
      status: "pending",
      batchId: batch.id,
    })),
  });

  return { batch, created: slice.length };
}
