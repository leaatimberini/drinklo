import { computeSlaDueAt } from "./dast-findings";
import { summarizeFindings } from "./dast-view";

describe("DAST helpers", () => {
  it("computes SLA by severity", () => {
    const base = new Date("2026-02-12T00:00:00.000Z");
    expect(computeSlaDueAt("critical", base).toISOString()).toBe("2026-02-19T00:00:00.000Z");
    expect(computeSlaDueAt("high", base).toISOString()).toBe("2026-02-26T00:00:00.000Z");
    expect(computeSlaDueAt("medium", base).toISOString()).toBe("2026-03-14T00:00:00.000Z");
  });

  it("summarizes findings for UI list", () => {
    const summary = summarizeFindings([
      { severity: "high", status: "open" },
      { severity: "high", status: "triaged" },
      { severity: "low", status: "open" },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.bySeverity.high).toBe(2);
    expect(summary.byStatus.open).toBe(2);
  });
});
