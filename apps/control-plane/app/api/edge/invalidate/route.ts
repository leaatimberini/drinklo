import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

function isIngestAuthorized(req: Request) {
  const expected = process.env.CONTROL_PLANE_INGEST_TOKEN ?? "";
  if (!expected) return false;
  const token = req.headers.get("x-cp-ingest-token") ?? "";
  return token === expected;
}

export async function POST(req: Request) {
  if (!isIngestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const instanceId = String(body.instanceId ?? "").trim();
  const reason = String(body.reason ?? "manual").trim();
  const tags = Array.isArray(body.tags) ? body.tags.map((tag: any) => String(tag)).slice(0, 200) : [];
  const paths = Array.isArray(body.paths) ? body.paths.map((path: any) => String(path)).slice(0, 200) : [];
  const companyId = body.companyId ? String(body.companyId) : null;
  const payload = body.payload && typeof body.payload === "object" ? body.payload : null;

  if (!instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }

  const installation = await prisma.installation.findUnique({ where: { instanceId }, select: { id: true } });
  const invalidation = await prisma.edgeInvalidation.create({
    data: {
      installationId: installation?.id ?? null,
      instanceId,
      companyId,
      reason,
      tags,
      paths,
      payload,
      status: "queued",
    },
  });

  return NextResponse.json({ ok: true, invalidationId: invalidation.id });
}
