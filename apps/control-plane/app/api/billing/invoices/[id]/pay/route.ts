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
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
  if (!token) {
    return NextResponse.json({ ok: false, reason: "missing_mp_token" }, { status: 400 });
  }

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      items: [
        {
          title: `Subscription ${invoice.account.instanceId}`,
          quantity: 1,
          currency_id: invoice.currency,
          unit_price: invoice.amount,
        },
      ],
      metadata: { invoiceId: invoice.id, accountId: invoice.accountId },
      notification_url: process.env.MERCADOPAGO_WEBHOOK_URL ?? undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ ok: false, error: text }, { status: 400 });
  }
  const data = await res.json();
  return NextResponse.json({ ok: true, initPoint: data.init_point, preferenceId: data.id });
}
