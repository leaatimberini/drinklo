import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { applyCommissionForInvoice } from "../../../lib/partner-program";
import { applyPricingExperimentOfferToInvoice } from "../../../lib/pricing-experiments";

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
  const requestedAmount = Number(body.amount ?? account.plan.price);
  if (!Number.isFinite(requestedAmount) || requestedAmount < 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }
  const invoice = await prisma.billingInvoice.create({
    data: {
      accountId: account.id,
      amount: requestedAmount,
      currency: body.currency ?? account.plan.currency,
      dueAt: body.dueAt ? new Date(body.dueAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      provider: body.provider ?? account.provider,
    },
  });
  const offerApplied = await applyPricingExperimentOfferToInvoice(prisma as any, {
    billingAccountId: account.id,
    invoiceId: invoice.id,
    amount: requestedAmount,
    currency: invoice.currency,
    actor: "cp:billing-invoices",
  }).catch(() => ({
    applied: false,
    baseAmount: requestedAmount,
    discountAmount: 0,
    finalAmount: requestedAmount,
    percentOff: 0,
    reason: "offer_apply_failed",
  }));
  const finalInvoice =
    offerApplied.applied && Number(offerApplied.finalAmount) !== Number(invoice.amount)
      ? await prisma.billingInvoice.update({
          where: { id: invoice.id },
          data: { amount: Number(offerApplied.finalAmount) },
        })
      : invoice;
  await applyCommissionForInvoice({
    prisma,
    billingAccountId: account.id,
    invoiceAmount: finalInvoice.amount,
    currency: finalInvoice.currency,
  });
  return NextResponse.json({ invoice: finalInvoice, offerApplied });
}
