import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

function requireToken(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const expected = process.env.CONTROL_PLANE_ADMIN_TOKEN ?? "";
  return token && expected && token === expected;
}

export async function GET(req: NextRequest) {
  if (!requireToken(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const plans = await prisma.billingPlan.findMany({ orderBy: { createdAt: "desc" } });
  const accounts = await prisma.billingAccount.findMany({
    include: { plan: true, invoices: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ plans, accounts });
}

export async function POST(req: NextRequest) {
  if (!requireToken(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  if (!body?.kind) return NextResponse.json({ error: "kind required" }, { status: 400 });

  if (body.kind === "plan") {
    const plan = await prisma.billingPlan.create({
      data: {
        name: body.name,
        price: body.price,
        currency: body.currency,
        period: body.period,
        features: body.features ?? [],
        rpoTargetMin: body.rpoTargetMin ?? null,
        rtoTargetMin: body.rtoTargetMin ?? null,
      },
    });
    return NextResponse.json(plan);
  }

  if (body.kind === "account") {
    const installation = await prisma.installation.findUnique({ where: { instanceId: body.instanceId } });
    if (!installation) return NextResponse.json({ error: "installation not found" }, { status: 404 });
    const plan = await prisma.billingPlan.findUnique({ where: { id: body.planId } });
    if (!plan) return NextResponse.json({ error: "plan not found" }, { status: 404 });
    const account = await prisma.billingAccount.create({
      data: {
        installationId: installation.id,
        instanceId: body.instanceId,
        clientName: body.clientName ?? null,
        email: body.email ?? null,
        planId: body.planId,
        status: body.status ?? "ACTIVE",
        provider: body.provider ?? "MANUAL",
        nextBillingAt: body.nextBillingAt ? new Date(body.nextBillingAt) : null,
      },
    });
    await prisma.installation.update({
      where: { id: installation.id },
      data: {
        clientName: body.clientName ?? installation.clientName ?? null,
        drPlan: plan.name,
        rpoTargetMin: plan.rpoTargetMin ?? undefined,
        rtoTargetMin: plan.rtoTargetMin ?? undefined,
      },
    });
    return NextResponse.json(account);
  }

  return NextResponse.json({ error: "unsupported kind" }, { status: 400 });
}
