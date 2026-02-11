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

  const pluginName = String(body.pluginName ?? body.plugin_name ?? "").trim();
  const version = body.version ? String(body.version) : null;
  const action = String(body.action ?? "install");

  if (!pluginName) {
    return NextResponse.json({ error: "pluginName required" }, { status: 400 });
  }

  const request = await prisma.pluginRequest.create({
    data: {
      instanceId,
      pluginName,
      version,
      action,
      status: "pending",
    },
  });

  return NextResponse.json({ id: request.id });
}
