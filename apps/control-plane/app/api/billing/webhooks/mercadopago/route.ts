import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { recordBillingPaymentLifecycleEvents } from "../../../../lib/trial-funnel-analytics";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-webhook-token") ?? "";
  const expected = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "";
  if (expected && token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const data = body.data ?? {};
  const preferenceId = data.preference_id ?? body.preference_id;
  const status = data.status ?? body.status ?? "unknown";
  const metadata = data.metadata ?? body.metadata ?? {};
  const invoiceId = metadata.invoiceId;

  if (invoiceId) {
    const invoice = await prisma.billingInvoice.update({
      where: { id: invoiceId },
      data: { status: status === "approved" ? "PAID" : "OPEN", paidAt: status === "approved" ? new Date() : null },
    });
    await prisma.billingPayment.create({
      data: {
        accountId: invoice.accountId,
        invoiceId,
        provider: "MERCADOPAGO",
        status,
        amount: Number(data.transaction_amount ?? invoice.amount),
        currency: data.currency_id ?? invoice.currency,
        externalId: preferenceId ?? null,
        raw: body,
      },
    });
    if (status === "approved") {
      await recordBillingPaymentLifecycleEvents(prisma as any, {
        billingAccountId: invoice.accountId,
        invoiceId: invoice.id,
        provider: "MERCADOPAGO",
        paidAt: new Date(),
        source: "mp-webhook",
        raw: body,
      }).catch(() => undefined);
    }
  }

  return NextResponse.json({ ok: true });
}
