import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-security-token") ?? "";
  const expected = process.env.CONTROL_PLANE_SECURITY_TOKEN ?? "";
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const instanceId = body.instanceId ?? null;
  let installationId: string | null = null;
  if (instanceId) {
    const installation = await prisma.installation.findUnique({ where: { instanceId } });
    installationId = installation?.id ?? null;
  }

  const report = await prisma.securityReport.create({
    data: {
      installationId,
      instanceId,
      repo: body.repo ?? null,
      sha: body.sha ?? null,
      runId: body.runId ?? null,
      kind: body.kind ?? "ci",
      status: body.status ?? "unknown",
      summary: body.summary ?? null,
    },
  });

  return NextResponse.json({ ok: true, id: report.id });
}
