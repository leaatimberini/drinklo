import { baDateRangeToUtc } from "./ba-time";

describe("baDateRangeToUtc", () => {
  it("converts BA date range to UTC", () => {
    const { fromUtc, toUtc } = baDateRangeToUtc("2026-02-10", "2026-02-10");
    expect(fromUtc.toISOString()).toBe("2026-02-10T03:00:00.000Z");
    expect(toUtc.toISOString()).toBe("2026-02-11T02:59:59.999Z");
  });

  it("rejects invalid ranges", () => {
    expect(() => baDateRangeToUtc("2026-02-11", "2026-02-10")).toThrow("invalid range");
  });
});

