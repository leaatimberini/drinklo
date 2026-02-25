import { expect, test } from "@playwright/test";
import { PrismaClient as ControlPlanePrismaClient } from "../../apps/control-plane/app/lib/generated/prisma";
// Root package does not depend on @prisma/client directly; resolve from packages/db workspace.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient: InstancePrismaClient } = require("../../packages/db/node_modules/@prisma/client");

const apiUrl = (process.env.BILLING_E2E_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const adminUrl = (process.env.BILLING_E2E_ADMIN_URL ?? "http://localhost:3002").replace(/\/$/, "");
const storefrontUrl = (process.env.BILLING_E2E_STOREFRONT_URL ?? "http://localhost:3003").replace(/\/$/, "");
const controlPlaneUrl = (process.env.BILLING_E2E_CONTROL_PLANE_URL ?? "http://localhost:3010").replace(/\/$/, "");

const instanceDbUrl = process.env.BILLING_E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const controlPlaneDbUrl = process.env.BILLING_E2E_CONTROL_PLANE_DATABASE_URL ?? process.env.CONTROL_PLANE_DATABASE_URL ?? "";
const enableMutations = (process.env.BILLING_E2E_ENABLE_MUTATIONS ?? "").toLowerCase() === "true";
const cpAdminToken = process.env.BILLING_E2E_CONTROL_PLANE_ADMIN_TOKEN ?? process.env.CONTROL_PLANE_ADMIN_TOKEN ?? "";

const instanceAdminEmail = process.env.BILLING_E2E_ADMIN_EMAIL ?? "admin@acme.local";
const instanceAdminPassword = process.env.BILLING_E2E_ADMIN_PASSWORD ?? "admin123";

let instancePrisma: any;
let cpPrisma: ControlPlanePrismaClient | null = null;

type InstanceCtx = {
  companyId: string;
  adminUserId: string;
  accessToken: string;
};

type CpCtx = {
  c1PlanId: string;
  c2PlanId: string;
};

const instanceContext: Partial<InstanceCtx> = {};
const cpContext: Partial<CpCtx> = {};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function instanceLogin(request: any) {
  const res = await request.post(`${apiUrl}/auth/login`, {
    data: { email: instanceAdminEmail, password: instanceAdminPassword },
  });
  expect(res.ok(), `auth/login failed: ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  expect(body.accessToken).toBeTruthy();
  return body.accessToken as string;
}

async function ensureInstanceContext(request: any) {
  if (!instancePrisma) {
    instancePrisma = new InstancePrismaClient({
      datasources: { db: { url: instanceDbUrl } },
    });
  }

  const admin = await instancePrisma.user.findFirst({
    where: { email: instanceAdminEmail, deletedAt: null },
    select: { id: true, companyId: true },
  });
  expect(admin, `seed admin not found: ${instanceAdminEmail}`).toBeTruthy();
  instanceContext.companyId = admin.companyId;
  instanceContext.adminUserId = admin.id;
  instanceContext.accessToken = await instanceLogin(request);
  return instanceContext as InstanceCtx;
}

async function ensureControlPlaneContext(request: any) {
  if (!cpPrisma) {
    cpPrisma = new ControlPlanePrismaClient({
      datasources: { db: { url: controlPlaneDbUrl } as any },
    } as any);
  }

  const ensurePlan = async (tier: "C1" | "C2") => {
    const existing =
      (await cpPrisma!.billingPlan.findFirst({
        where: { name: { equals: tier, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
      })) ??
      (await cpPrisma!.billingPlan.create({
        data: {
          name: tier,
          price: tier === "C1" ? 10000 : 20000,
          currency: "ARS",
          period: "MONTHLY",
          features: [`${tier}_BASE`],
          trialDays: 30,
        },
      }));
    return existing.id;
  };

  cpContext.c1PlanId = await ensurePlan("C1");
  cpContext.c2PlanId = await ensurePlan("C2");

  // Sanity check token against control-plane billing endpoint.
  const res = await request.get(`${controlPlaneUrl}/api/billing`, {
    headers: { Authorization: `Bearer ${cpAdminToken}` },
  });
  expect(res.ok(), `control-plane /api/billing failed: ${await res.text()}`).toBeTruthy();
  return cpContext as CpCtx;
}

async function setSubscriptionState(patch: Record<string, any>) {
  const companyId = instanceContext.companyId!;
  const current = await instancePrisma.subscription.findUniqueOrThrow({ where: { companyId } });
  return instancePrisma.subscription.update({
    where: { companyId },
    data: patch,
  });
}

async function getSubscription(request: any) {
  const token = instanceContext.accessToken!;
  const res = await request.get(`${apiUrl}/admin/plans/subscription`, { headers: authHeaders(token) });
  expect(res.ok(), `subscription fetch failed: ${await res.text()}`).toBeTruthy();
  return res.json();
}

async function getEntitlements(request: any) {
  const token = instanceContext.accessToken!;
  const res = await request.get(`${apiUrl}/admin/plans/entitlements`, { headers: authHeaders(token) });
  expect(res.ok(), `entitlements fetch failed: ${await res.text()}`).toBeTruthy();
  return res.json();
}

async function runLifecycleJob(request: any, job: string) {
  const token = instanceContext.accessToken!;
  const res = await request.post(`${apiUrl}/admin/plans/lifecycle/run/${job}`, {
    headers: authHeaders(token),
    data: {},
  });
  expect(res.ok(), `lifecycle ${job} failed: ${await res.text()}`).toBeTruthy();
  return res.json();
}

async function applyDuePlanChanges(request: any, now?: Date) {
  const token = instanceContext.accessToken!;
  const res = await request.post(`${apiUrl}/admin/support/billing/apply-due`, {
    headers: authHeaders(token),
    data: now ? { now: now.toISOString() } : {},
  });
  expect(res.ok(), `apply-due failed: ${await res.text()}`).toBeTruthy();
  return res.json();
}

test.describe.serial("billing e2e", () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    // no-op; clients are lazy
  });

  test.afterAll(async () => {
    await instancePrisma?.$disconnect?.().catch(() => undefined);
    await cpPrisma?.$disconnect().catch(() => undefined);
  });

  test.beforeEach(async ({ request }) => {
    test.skip(!enableMutations, "Set BILLING_E2E_ENABLE_MUTATIONS=true to run destructive billing E2E tests.");
    test.skip(!instanceDbUrl, "Missing BILLING_E2E_DATABASE_URL / DATABASE_URL.");
    await ensureInstanceContext(request);
  });

  test("1) signup sin codigo -> trial activo 30d (C1) [control-plane direct signup path]", async ({ request }) => {
    test.skip(!controlPlaneDbUrl || !cpAdminToken, "Missing control-plane DB URL/token for billing signup E2E.");
    const cp = await ensureControlPlaneContext(request);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const instanceId = `e2e-nosignup-${suffix}`;

    await cpPrisma!.installation.upsert({
      where: { instanceId },
      update: {},
      create: {
        instanceId,
        clientName: `E2E NoCode ${suffix}`,
        domain: `nocode-${suffix}.example.test`,
        releaseChannel: "stable",
        healthStatus: "provisioning",
      },
    });

    const res = await request.post(`${controlPlaneUrl}/api/billing`, {
      headers: { Authorization: `Bearer ${cpAdminToken}` },
      data: {
        kind: "account",
        instanceId,
        clientName: `E2E NoCode ${suffix}`,
        email: `nocode-${suffix}@example.test`,
        planId: cp.c1PlanId,
        businessType: "kiosco",
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.plan?.name?.toUpperCase()).toContain("C1");
    expect(body.trialEndsAt ?? body?.trialEndsAt).toBeTruthy();

    const trialEnd = new Date(body.trialEndsAt ?? body?.trialEndsAt ?? body.account?.trialEndsAt);
    const diffDays = Math.round((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  test("2) signup con campana -> trial con durationDays y atribucion", async ({ request }) => {
    test.skip(!controlPlaneDbUrl || !cpAdminToken, "Missing control-plane DB URL/token for campaign signup E2E.");
    await ensureControlPlaneContext(request);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const code = `E2E${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const durationDays = 14;
    const campaign = await cpPrisma!.trialCampaign.create({
      data: {
        code,
        tier: "C2",
        durationDays,
        status: "ACTIVE",
        allowedDomains: [],
        blockedDomains: [],
      },
    });

    const signupRes = await request.post(`${controlPlaneUrl}/api/signup`, {
      data: {
        trial: code,
        companyName: `E2E Campaign ${suffix}`,
        domain: `campaign-${suffix}.example.test`,
        email: `owner-${suffix}@example.test`,
        fingerprint: `fp-${suffix}`,
        utmSource: "ads",
        utmCampaign: "feb-launch",
        referral: "partner-demo",
        businessType: "distribuidora",
      },
    });
    expect(signupRes.ok(), await signupRes.text()).toBeTruthy();
    const signup = await signupRes.json();
    expect(signup.status).toBe("REDEEMED");
    expect(signup.campaign.code).toBe(code);
    expect(signup.campaign.durationDays).toBe(durationDays);
    expect(signup.account?.instanceId).toBeTruthy();

    const trialEnd = new Date(signup.account.trialEndsAt);
    const diffDays = Math.round((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBeGreaterThanOrEqual(durationDays - 1);
    expect(diffDays).toBeLessThanOrEqual(durationDays + 1);

    const lead = await cpPrisma!.leadAttribution.findUnique({ where: { id: signup.leadAttributionId } });
    expect(lead?.utmSource).toBe("ads");
    expect(lead?.utmCampaign).toBe("feb-launch");
    expect(lead?.referral).toBe("partner-demo");
    expect(lead?.businessType).toBe("distribuidora");

    await cpPrisma!.trialCampaign.update({
      where: { id: campaign.id },
      data: { status: "REVOKED", revokedAt: new Date(), updatedBy: "e2e" },
    });
  });

  test("3) expira trial -> GRACE -> RESTRICTED y aplica restricciones correctas", async ({ request, page }) => {
    const now = new Date();
    await instancePrisma.companySettings.update({
      where: { companyId: instanceContext.companyId! },
      data: { restrictedModeVariant: "CATALOG_ONLY" },
    });
    await setSubscriptionState({
      status: "TRIAL_ACTIVE",
      currentTier: "C1",
      nextTier: null,
      trialEndAt: new Date(now.getTime() - 60 * 60 * 1000),
      graceEndAt: null,
      lastPaymentAt: null,
      cancelAtPeriodEnd: false,
      softLimited: false,
      softLimitReason: null,
      softLimitSnapshot: null,
    });

    await runLifecycleJob(request, "trial-expirer");
    let subscription = await getSubscription(request);
    expect(subscription.status).toBe("GRACE");
    expect(subscription.graceEndAt).toBeTruthy();

    await setSubscriptionState({ graceEndAt: new Date(Date.now() - 60 * 1000) });
    await runLifecycleJob(request, "grace-expirer");
    subscription = await getSubscription(request);
    expect(subscription.status).toBe("RESTRICTED");

    const writeRes = await request.post(`${apiUrl}/products`, {
      headers: authHeaders(instanceContext.accessToken!),
      data: { name: "Blocked in restricted mode" },
    });
    expect(writeRes.status()).toBeGreaterThanOrEqual(400);
    const writePayload = await writeRes.json().catch(() => ({}));
    expect(writePayload.code).toBe("SUBSCRIPTION_RESTRICTED");

    if (storefrontUrl) {
      await page.goto(`${storefrontUrl}/checkout`, { waitUntil: "networkidle" });
      await expect(page.getByText(/Modo catalogo activo/i)).toBeVisible();
    }
  });

  test("4) upgrade durante trial -> muestra plan (cobro inicia al convertir)", async ({ request }) => {
    const now = new Date();
    await setSubscriptionState({
      status: "TRIAL_ACTIVE",
      currentTier: "C1",
      nextTier: null,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000),
      trialEndAt: new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000),
      graceEndAt: null,
      lastPaymentAt: null,
      mpPreapprovalId: null,
      mpPreapprovalStatus: null,
      mpNextBillingDate: null,
      billingProvider: null,
    });
    await instancePrisma.companySettings.update({
      where: { companyId: instanceContext.companyId! },
      data: { sandboxMode: true },
    });

    const upgradeRes = await request.post(`${apiUrl}/billing/upgrade`, {
      headers: authHeaders(instanceContext.accessToken!),
      data: { targetTier: "C2" },
    });
    expect(upgradeRes.ok(), await upgradeRes.text()).toBeTruthy();
    const upgrade = await upgradeRes.json();
    expect(upgrade.direction).toBe("UPGRADE");
    expect(upgrade.subscription.currentTier).toBe("C2");
    expect(upgrade.subscription.status).toBe("TRIAL_ACTIVE");

    const subscription = await getSubscription(request);
    expect(subscription.currentTier).toBe("C2");
    expect(subscription.status).toBe("TRIAL_ACTIVE");
    expect(subscription.lastPaymentAt).toBeFalsy();
  });

  test("5) convert to paid (mock payment) -> ACTIVE_PAID + entitlements correctos", async ({ request }) => {
    const paidAt = new Date();
    const nextPeriodEnd = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    await setSubscriptionState({
      status: "ACTIVE_PAID",
      currentTier: "C2",
      lastPaymentAt: paidAt,
      currentPeriodStart: paidAt,
      currentPeriodEnd: nextPeriodEnd,
      graceEndAt: null,
      softLimited: false,
      softLimitReason: null,
      softLimitSnapshot: null,
    });

    const subscription = await getSubscription(request);
    expect(subscription.status).toBe("ACTIVE_PAID");
    expect(subscription.currentTier).toBe("C2");
    expect(subscription.lastPaymentAt).toBeTruthy();

    const effective = await getEntitlements(request);
    expect(effective.subscription.status).toBe("ACTIVE_PAID");
    expect(effective.subscription.currentTier).toBe("C2");
    expect(effective.entitlements.tier).toBe("C2");
    expect(Number(effective.entitlements.ordersMonth)).toBeGreaterThan(0);
  });

  test("6) downgrade programado -> aplica proximo ciclo sin borrar data y con soft limits", async ({ request }) => {
    const now = new Date();
    await setSubscriptionState({
      status: "ACTIVE_PAID",
      currentTier: "C3",
      nextTier: null,
      currentPeriodStart: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      lastPaymentAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      graceEndAt: null,
      softLimited: false,
      softLimitReason: null,
      softLimitSnapshot: null,
    });

    const usageCurrentRes = await request.get(`${apiUrl}/admin/plans/usage/current`, {
      headers: authHeaders(instanceContext.accessToken!),
    });
    expect(usageCurrentRes.ok(), await usageCurrentRes.text()).toBeTruthy();
    const usage = await usageCurrentRes.json();
    await instancePrisma.usageCounter.update({
      where: {
        companyId_periodKey: {
          companyId: instanceContext.companyId!,
          periodKey: usage.periodKey,
        },
      },
      data: {
        ordersCount: 999999,
        apiCallsCount: 999999,
        storageGbUsed: 999,
        pluginsCount: 50,
        branchesCount: 25,
        adminUsersCount: 100,
      },
    });
    const productCountBefore = await instancePrisma.product.count({ where: { companyId: instanceContext.companyId! } });

    const scheduleRes = await request.post(`${apiUrl}/billing/downgrade`, {
      headers: authHeaders(instanceContext.accessToken!),
      data: { targetTier: "C1" },
    });
    expect(scheduleRes.ok(), await scheduleRes.text()).toBeTruthy();
    const scheduled = await scheduleRes.json();
    expect(scheduled.scheduled).toBeTruthy();
    expect(scheduled.subscription.nextTier).toBe("C1");

    await setSubscriptionState({
      currentPeriodEnd: new Date(Date.now() - 5 * 60 * 1000),
    });
    await applyDuePlanChanges(request, new Date());

    const subscription = await getSubscription(request);
    expect(subscription.currentTier).toBe("C1");
    expect(subscription.nextTier).toBeNull();
    expect(subscription.softLimited).toBeTruthy();
    expect(subscription.softLimitReason).toBe("DOWNGRADE_QUOTA_EXCEEDED_SOFT_LIMIT");

    const productCountAfter = await instancePrisma.product.count({ where: { companyId: instanceContext.companyId! } });
    expect(productCountAfter).toBe(productCountBefore);
  });

  test("7) PAST_DUE -> GRACE -> RESTRICTED", async ({ request }) => {
    const now = new Date();
    await setSubscriptionState({
      status: "ACTIVE_PAID",
      currentTier: "C1",
      currentPeriodStart: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      lastPaymentAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      graceEndAt: null,
      cancelAtPeriodEnd: false,
    });

    await runLifecycleJob(request, "past-due-handler");
    let subscription = await getSubscription(request);
    expect(subscription.status).toBe("GRACE");
    expect(subscription.graceEndAt).toBeTruthy();

    await setSubscriptionState({ graceEndAt: new Date(Date.now() - 60 * 1000) });
    await runLifecycleJob(request, "grace-expirer");
    subscription = await getSubscription(request);
    expect(subscription.status).toBe("RESTRICTED");
  });
});

