import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const instanceId = String(body.instanceId ?? "").trim();
  const adminToken = String(body.adminToken ?? "").trim();
  const apiBaseUrlInput = String(body.apiBaseUrl ?? "").trim();

  if (!instanceId) {
    return NextResponse.json({ error: "instanceId is required" }, { status: 400 });
  }
  if (!adminToken) {
    return NextResponse.json({ error: "adminToken is required" }, { status: 400 });
  }

  const installation = await prisma.installation.findUnique({ where: { instanceId } });
  if (!installation) {
    return NextResponse.json({ error: "installation not found" }, { status: 404 });
  }

  const fallbackBase = installation.domain ? `https://${installation.domain}` : "";
  const apiBaseUrl = apiBaseUrlInput || fallbackBase;
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "apiBaseUrl required when installation has no domain" }, { status: 400 });
  }

  const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/admin/sandbox/reset`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: "sandbox reset failed", endpoint, payload }, { status: 502 });
  }

  return NextResponse.json({ ok: true, endpoint, payload });
}
