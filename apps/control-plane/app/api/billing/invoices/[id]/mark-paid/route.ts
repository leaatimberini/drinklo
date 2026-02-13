import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

function requireToken(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const expected = process.env.CONTROL_PLANE_ADMIN_TOKEN ?? "";
  return token && expected && token === expected;
}

export async function POST(req: NextRequest, ctx: any) {
  if (!requireToken(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = ctx?.params?.id as string;
  const invoice = await prisma.billingInvoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });

  const updated = await prisma.billingInvoice.update({
    where: { id: invoice.id },
    data: { status: "PAID", paidAt: new Date() },
  });
  await prisma.billingPayment.create({
    data: {
      accountId: updated.accountId,
      invoiceId: updated.id,
      provider: updated.provider,
      status: "PAID",
      amount: updated.amount,
      currency: updated.currency,
    },
  });
  return NextResponse.json(updated);
}
