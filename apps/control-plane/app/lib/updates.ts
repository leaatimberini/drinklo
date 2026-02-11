import { prisma } from "./prisma";

export async function createBatch(
  rolloutId: string,
  batchIndex: number,
  batchSize: number,
  channel: string,
  manifestId: string,
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

  const batch = await prisma.rolloutBatch.create({
    data: { rolloutId, batchIndex, status: "running" },
  });

  await prisma.updateJob.createMany({
    data: slice.map((inst) => ({
      installationId: inst.id,
      manifestId,
      batchId: batch.id,
      status: "pending",
    })),
  });

  return { batch, created: slice.length };
}
