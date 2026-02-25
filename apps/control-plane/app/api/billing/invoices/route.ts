import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { applyCommissionForInvoice } from "../../../lib/partner-program";

function requireToken(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const expected = process.env.CONTROL_PLANE_ADMIN_TOKEN ?? "";
  return token && expected && token === expected;
}

export async function POST(req: NextRequest) {
  if (!requireToken(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const account = await prisma.billingAccount.findUnique({ where: { id: body.accountId }, include: { plan: true } });
  if (!account) return NextResponse.json({ error: "account not found" }, { status: 404 });
  const invoice = await prisma.billingInvoice.create({
    data: {
      accountId: account.id,
      amount: body.amount ?? account.plan.price,
      currency: body.currency ?? account.plan.currency,
      dueAt: body.dueAt ? new Date(body.dueAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      provider: body.provider ?? account.provider,
    },
  });
  await applyCommissionForInvoice({
    prisma,
    billingAccountId: account.id,
    invoiceAmount: invoice.amount,
    currency: invoice.currency,
  });
  return NextResponse.json(invoice);
}
