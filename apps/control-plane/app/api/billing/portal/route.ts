import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-portal-token") ?? "";
  const expected = process.env.CONTROL_PLANE_BILLING_PORTAL_TOKEN ?? "";
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get("instanceId");
  if (!instanceId) return NextResponse.json({ error: "instanceId required" }, { status: 400 });

  const account = await prisma.billingAccount.findUnique({
    where: { instanceId },
    include: { plan: true, invoices: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!account) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    account: {
      instanceId: account.instanceId,
      clientName: account.clientName,
      email: account.email,
      status: account.status,
      plan: account.plan,
      nextBillingAt: account.nextBillingAt,
    },
    invoices: account.invoices,
  });
}
