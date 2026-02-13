import { validateEvent } from "@erp/shared";

describe("event model contract", () => {
  it("accepts a valid event envelope", () => {
    const result = validateEvent({
      id: "evt-1",
      name: "OrderCreated",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      source: "api",
      payload: { orderId: "o1" },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid event names", () => {
    const result = validateEvent({
      id: "evt-2",
      name: "UnknownEvent",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      source: "api",
      payload: {},
    });
    expect(result.ok).toBe(false);
  });

  it("keeps backward compatibility with schema v1 and extra fields", () => {
    const result = validateEvent({
      id: "evt-3",
      name: "CartUpdated",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      source: "storefront",
      payload: { itemsCount: 2 },
      extra: { legacy: true },
    });
    expect(result.ok).toBe(true);
  });

  it("accepts FeatureUsageEvent", () => {
    const result = validateEvent({
      id: "evt-4",
      name: "FeatureUsageEvent",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      source: "admin",
      payload: { feature: "pos", action: "view", pathname: "/pos" },
    });
    expect(result.ok).toBe(true);
  });
});
