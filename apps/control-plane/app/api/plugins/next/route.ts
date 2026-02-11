import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { verifyAgentSignature } from "../../../lib/agent-auth";

export async function POST(req: Request) {
  const signature = req.headers.get("x-agent-signature") ?? "";
  const rawBody = await req.text();
  const body = JSON.parse(rawBody);
  const instanceId = body.instance_id;

  if (!instanceId || !signature) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!verifyAgentSignature(rawBody, signature, instanceId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const job = await prisma.pluginJob.findFirst({
    where: { instanceId, status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  if (!job) {
    return new NextResponse(null, { status: 204 });
  }

  await prisma.pluginJob.update({
    where: { id: job.id },
    data: { status: "in_progress", startedAt: new Date(), step: "accepted" },
  });

  return NextResponse.json({
    job_id: job.id,
    plugin: {
      name: job.pluginName,
      version: job.version,
      action: job.action,
    },
  });
}
