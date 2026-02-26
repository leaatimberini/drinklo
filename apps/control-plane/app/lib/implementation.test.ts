import assert from "node:assert/strict";
import test from "node:test";
import {
  blockedOnboardingStepHints,
  buildChecklistItemsFromTemplate,
  computeImplementationReadiness,
  getImplementationChecklistTemplate,
} from "./implementation";

test("implementation checklist template varies by ICP", () => {
  const kiosco = getImplementationChecklistTemplate("kiosco");
  const dist = getImplementationChecklistTemplate("distribuidora");
  const enterprise = getImplementationChecklistTemplate("enterprise");

  assert.equal(kiosco.some((t) => t.taskKey === "configure_wholesale_lists"), false);
  assert.equal(dist.some((t) => t.taskKey === "configure_wholesale_lists"), true);
  assert.equal(dist.some((t) => t.taskKey === "configure_delivery"), true);
  assert.equal(enterprise.some((t) => t.taskKey === "security_pack_review"), true);
});

test("build checklist due dates are deterministic from kickoff", () => {
  const items = buildChecklistItemsFromTemplate({ icp: "kiosco", kickoffAt: "2026-02-01T00:00:00.000Z" });
  const importCatalog = items.find((i) => i.taskKey === "import_catalog");
  const firstSale = items.find((i) => i.taskKey === "first_sale_or_order");
  assert.equal(importCatalog?.dueAt.toISOString(), "2026-02-03T00:00:00.000Z");
  assert.equal(firstSale?.dueAt.toISOString(), "2026-02-08T00:00:00.000Z");
});

test("blocked onboarding hints only include incomplete items", () => {
  const hints = blockedOnboardingStepHints([
    { status: "PENDING", onboardingStepHint: "import_catalog" },
    { status: "DONE", onboardingStepHint: "configure_mercadopago" },
    { status: "BLOCKED", onboardingStepHint: "configure_shipping" },
    { status: "WAIVED", onboardingStepHint: "test_print_scanner" },
  ]);
  assert.deepEqual(hints, ["import_catalog", "configure_shipping"]);
});

test("readiness semaphore combines checklist + activation + ops signals", () => {
  const red = computeImplementationReadiness({
    requiredTasks: [
      { taskKey: "a", status: "PENDING" },
      { taskKey: "b", status: "BLOCKED" },
    ],
    activationScore: 20,
    activationState: "NOT_ACTIVATED",
    backupsVerified30d: 0,
    drDrills30d: 0,
  });
  assert.equal(red.color, "RED");

  const yellow = computeImplementationReadiness({
    requiredTasks: [
      { taskKey: "a", status: "DONE" },
      { taskKey: "b", status: "PENDING" },
    ],
    activationScore: 55,
    activationState: "ACTIVATING",
    toursCompleted: 2,
    academyCertifiedCount: 0,
    backupsVerified30d: 1,
    drDrills30d: 0,
  });
  assert.equal(yellow.color, "YELLOW");

  const green = computeImplementationReadiness({
    requiredTasks: [
      { taskKey: "a", status: "DONE" },
      { taskKey: "b", status: "DONE" },
      { taskKey: "c", status: "WAIVED" },
    ],
    activationScore: 82,
    activationState: "ACTIVATED",
    toursCompleted: 4,
    academyCertifiedCount: 1,
    backupsVerified30d: 2,
    drDrills30d: 1,
  });
  assert.equal(green.color, "GREEN");
  assert.equal(green.checklistPct, 100);
});

