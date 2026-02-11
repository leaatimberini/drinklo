import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

async function createAlertOnce(installationId: string, message: string) {
  const recent = await prisma.alert.findFirst({
    where: {
      installationId,
      message,
      createdAt: { gt: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
  });
  if (!recent) {
    await prisma.alert.create({
      data: {
        installationId,
        level: "warning",
        message,
      },
    });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.instanceId) {
    return NextResponse.json({ error: "missing_instance" }, { status: 400 });
  }

  const account = await prisma.billingAccount.findUnique({ where: { instanceId: body.instanceId }, include: { plan: true } });

  if (!account) {
    return NextResponse.json({ error: "account_missing" }, { status: 404 });
  }

  const latestInvoice = await prisma.billingInvoice.findFirst({
    where: { accountId: account.id, status: "OPEN" },
    orderBy: { dueAt: "desc" },
  });

  let status = account.status;
  let warning = false;
  let limitPremium = false;
  let suspend = false;

  if (latestInvoice) {
    const overdueDays = daysBetween(new Date(), latestInvoice.dueAt);
    if (overdueDays >= 1 && overdueDays <= 7) {
      warning = true;
    } else if (overdueDays > 7 && overdueDays <= 14) {
      limitPremium = true;
      status = "PAST_DUE";
    } else if (overdueDays > 14) {
      suspend = true;
      status = "SUSPENDED";
    }
  }

  const features = suspend || limitPremium ? [] : account.plan.features;
  const valid = true;

  await prisma.billingAccount.update({
    where: { id: account.id },
    data: {
      status,
      warningCount: warning ? { increment: 1 } : account.warningCount,
    },
  });

  if (warning) {
    await createAlertOnce(account.installationId, `Billing warning for ${account.instanceId}`);
  }
  if (limitPremium) {
    await createAlertOnce(account.installationId, `Billing past due for ${account.instanceId}`);
  }
  if (suspend) {
    await createAlertOnce(account.installationId, `Billing suspended for ${account.instanceId}`);
  }

  return NextResponse.json({
    valid,
    plan: account.plan.name,
    expiresAt: account.nextBillingAt?.toISOString() ?? null,
    features,
    reason: suspend ? "suspended" : limitPremium ? "past_due" : warning ? "warning" : undefined,
    warnings: warning,
  });
}
