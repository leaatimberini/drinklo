import assert from "node:assert/strict";
import test from "node:test";
import {
  loadProductToursForRuntime,
  normalizeProductTourInput,
  trackProductTourEvent,
} from "./product-tours";

test("normalize tour input validates and normalizes steps/trigger/condition", () => {
  const normalized = normalizeProductTourInput({
    key: " Admin Welcome ",
    name: "Admin Welcome",
    surface: "ADMIN",
    status: "active",
    locale: "es-AR",
    triggerType: "feature_unused",
    triggerConfig: { featureKey: "pos_used", minCount: 1 },
    condition: { rolesIn: ["admin"], icpIn: ["kiosco"] },
    steps: [{ title: "Paso", body: "Desc", targetSelector: "#main-content" }],
  });
  assert.equal(normalized.key, "admin-welcome");
  assert.equal(normalized.locale, "es");
  assert.equal(normalized.triggerType, "FEATURE_UNUSED");
  assert.equal(normalized.steps.length, 1);
  assert.equal(normalized.steps[0].order, 1);
});

test("runtime tour selection respects condition and trigger", async () => {
  const prisma = {
    installation: {
      async findUnique() {
        return { id: "inst-db-1" };
      },
    },
    productTour: {
      async findMany() {
        return [
          {
            id: "t1",
            key: "admin-first",
            name: "Admin First",
            surface: "ADMIN",
            status: "ACTIVE",
            locale: "es",
            title: null,
            description: null,
            condition: { rolesIn: ["admin"], icpIn: ["kiosco"] },
            triggerType: "FIRST_TIME",
            triggerConfig: null,
            steps: [{ id: "s1", order: 1, locale: null, title: "A", body: "B", targetSelector: "#main-content", placement: null, condition: null }],
          },
          {
            id: "t2",
            key: "billing-reminder",
            name: "Billing Reminder",
            surface: "ADMIN",
            status: "ACTIVE",
            locale: "es",
            condition: null,
            triggerType: "TRIAL_NEARING_END",
            triggerConfig: { daysRemainingLte: 3 },
            steps: [{ id: "s2", order: 1, locale: null, title: "Paga", body: "CTA", targetSelector: "#billing", placement: null, condition: null }],
          },
        ];
      },
    },
  };

  const rows = await loadProductToursForRuntime(prisma as any, {
    surface: "ADMIN",
    locale: "es-AR",
    role: "admin",
    icp: "kiosco",
    path: "/",
    instanceId: "inst-1",
    trialDaysRemaining: 2,
    seenTourKeys: [],
    completedTourKeys: [],
  });
  assert.deepEqual(rows.map((r) => r.key), ["admin-first", "billing-reminder"]);
});

test("tracking persists product tour event and evidence", async () => {
  const createdEvents: any[] = [];
  const createdEvidence: any[] = [];
  const prisma = {
    productTour: {
      async findUnique({ where }: any) {
        return where.key === "admin-first" ? { id: "t1", key: "admin-first" } : null;
      },
    },
    installation: {
      async findUnique() {
        return { id: "inst-db-1" };
      },
    },
    productTourEvent: {
      async create({ data }: any) {
        createdEvents.push(data);
        return { id: "evt-1", ...data };
      },
    },
    complianceEvidence: {
      async create({ data }: any) {
        createdEvidence.push(data);
        return { id: "ev-1", ...data };
      },
    },
  };

  const evt = await trackProductTourEvent(prisma as any, {
    tourKey: "admin-first",
    instanceId: "inst-1",
    surface: "ADMIN",
    eventType: "STARTED",
    sessionId: "sess-1",
    role: "admin",
    icp: "kiosco",
  });
  assert.equal(evt.tourId, "t1");
  assert.equal(createdEvents.length, 1);
  assert.equal(createdEvidence.length, 1);
  assert.equal(createdEvents[0].eventType, "STARTED");
});

