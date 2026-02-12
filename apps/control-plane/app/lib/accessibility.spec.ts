import { normalizeAccessibilityPayload } from "./accessibility";

describe("Accessibility helpers", () => {
  it("normalizes ingest payload and computes totals from pages", () => {
    const normalized = normalizeAccessibilityPayload({
      instanceId: "inst-1",
      version: "1.2.3",
      score: 92,
      pages: [
        { key: "home", url: "http://localhost:3003", criticalViolations: 0, seriousViolations: 1, totalViolations: 2 },
        { key: "pdp", url: "http://localhost:3003/products/1", criticalViolations: 1, seriousViolations: 0, totalViolations: 1 },
      ],
    });

    expect(normalized.criticalViolations).toBe(1);
    expect(normalized.seriousViolations).toBe(1);
    expect(normalized.totalViolations).toBe(3);
  });

  it("rejects invalid payload", () => {
    expect(() =>
      normalizeAccessibilityPayload({
        instanceId: "",
        version: "1.0.0",
        score: 90,
      }),
    ).toThrow("invalid payload");
  });
});
