import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTourTrackingEvent,
  evaluateTourCondition,
  selectToursForRuntime,
  type ProductTourDefinition,
} from "../src/product-tours";

test("tour conditions and triggers filter tours for runtime", () => {
  const tours: ProductTourDefinition[] = [
    {
      id: "t1",
      key: "admin_welcome_kiosco",
      name: "Admin Welcome",
      surface: "ADMIN",
      locale: "es",
      status: "ACTIVE",
      condition: { icpIn: ["kiosco"], rolesIn: ["admin"], pathPrefixes: ["/"] },
      trigger: { kind: "FIRST_TIME" },
      steps: [{ id: "s1", title: "Hola", body: "Paso 1", targetSelector: "#main-content", order: 1 }],
    },
    {
      id: "t2",
      key: "mp_connect_reminder",
      name: "MP Reminder",
      surface: "ADMIN",
      locale: "es",
      status: "ACTIVE",
      trigger: { kind: "FEATURE_UNUSED", featureKey: "mercadopago_connected" },
      steps: [{ id: "s2", title: "MP", body: "Conectar MP", targetSelector: "#mp-config", order: 1 }],
    },
    {
      id: "t3",
      key: "trial_end_cta",
      name: "Trial Ending",
      surface: "ADMIN",
      locale: "es",
      status: "ACTIVE",
      trigger: { kind: "TRIAL_NEARING_END", daysRemainingLte: 3 },
      steps: [{ id: "s3", title: "Pago", body: "Agregar pago", targetSelector: "#billing", order: 1 }],
    },
  ];

  const selected = selectToursForRuntime(tours, {
    surface: "ADMIN",
    locale: "es-AR",
    role: "admin",
    icp: "kiosco",
    path: "/dashboard",
    featureUsage: { mercadopago_connected: 0 },
    trialDaysRemaining: 2,
    seenTourKeys: [],
    completedTourKeys: [],
  });

  assert.deepEqual(
    selected.map((t) => t.key),
    ["admin_welcome_kiosco", "mp_connect_reminder", "trial_end_cta"],
  );

  const afterSeen = selectToursForRuntime(tours, {
    surface: "ADMIN",
    locale: "es",
    role: "admin",
    icp: "kiosco",
    path: "/",
    featureUsage: { mercadopago_connected: 3 },
    trialDaysRemaining: 10,
    seenTourKeys: ["admin_welcome_kiosco"],
    completedTourKeys: [],
  });
  assert.deepEqual(afterSeen.map((t) => t.key), []);
});

test("evaluateTourCondition handles locale/role/icp/path", () => {
  assert.equal(
    evaluateTourCondition(
      { rolesIn: ["manager"], icpIn: ["distribuidora"], localesIn: ["es"], pathPrefixes: ["/admin"] },
      { surface: "ADMIN", role: "manager", icp: "distribuidora", locale: "es-AR", path: "/admin/products" },
    ),
    true,
  );
  assert.equal(
    evaluateTourCondition(
      { rolesIn: ["admin"] },
      { surface: "ADMIN", role: "manager", icp: "kiosco", locale: "es", path: "/" },
    ),
    false,
  );
});

test("tracking event builder maps tour events into event model names", () => {
  const started = buildTourTrackingEvent({
    tourId: "t1",
    tourKey: "welcome",
    eventType: "STARTED",
    surface: "ADMIN",
    sessionId: "sess-1",
  });
  const completed = buildTourTrackingEvent({
    tourId: "t1",
    tourKey: "welcome",
    eventType: "COMPLETED",
    surface: "STOREFRONT",
    sessionId: "sess-2",
  });
  assert.equal(started.name, "TourStarted");
  assert.equal(completed.name, "TourCompleted");
  assert.equal(completed.payload.surface, "STOREFRONT");
});

