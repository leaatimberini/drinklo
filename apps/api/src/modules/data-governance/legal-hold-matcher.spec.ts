import { matchesHoldByCustomerId, matchesHoldByEmail } from "./legal-hold-matcher";

describe("legal-hold-matcher", () => {
  const hold = {
    customerId: "c1",
    customerEmailSnapshot: "test@customer.com",
    periodFrom: new Date("2026-01-01T00:00:00.000Z"),
    periodTo: new Date("2026-01-31T23:59:59.000Z"),
    status: "ACTIVE" as const,
  };

  it("matches by customer and period", () => {
    expect(matchesHoldByCustomerId([hold], "c1", new Date("2026-01-10T10:00:00.000Z"))).toBe(true);
    expect(matchesHoldByEmail([hold], "test@customer.com", new Date("2026-01-10T10:00:00.000Z"))).toBe(true);
  });

  it("does not match outside period", () => {
    expect(matchesHoldByCustomerId([hold], "c1", new Date("2026-02-01T00:00:00.000Z"))).toBe(false);
  });

  it("does not match released hold", () => {
    const released = { ...hold, status: "RELEASED" as const };
    expect(matchesHoldByEmail([released], "test@customer.com", new Date("2026-01-10T10:00:00.000Z"))).toBe(false);
  });
});
