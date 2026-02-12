import { NextRequest, NextResponse } from "next/server";
import { ingestDastFindings } from "../../../lib/dast-findings";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-security-token") ?? "";
  const expected = process.env.CONTROL_PLANE_SECURITY_TOKEN ?? "";
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.findings)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const result = await ingestDastFindings({
    instanceId: body.instanceId ?? null,
    repo: body.repo ?? null,
    sha: body.sha ?? null,
    runId: body.runId ?? null,
    status: body.status ?? "completed",
    summary: body.summary ?? null,
    findings: body.findings,
  });

  return NextResponse.json({ ok: true, ...result });
}
