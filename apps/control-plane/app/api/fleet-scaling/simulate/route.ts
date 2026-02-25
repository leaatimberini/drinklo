import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import { simulateFleetStability } from "../../../lib/fleet-scaling";

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const instances = Number(body.instances ?? 1000);
  const shardCount = Number(body.shardCount ?? 64);
  const seed = Number(body.seed ?? 42);
  const result = simulateFleetStability({
    instances,
    shardCount,
    seed,
    planMix: body.planMix && typeof body.planMix === "object" ? body.planMix : undefined,
  });
  return NextResponse.json(result);
}

