import { dlpSummary, redactDeep } from "./dlp-redactor";

describe("dlp-redactor", () => {
  it("redacts secret-like keys and bearer", () => {
    const payload = {
      password: "abc123",
      nested: {
        token: "top-secret",
        auth: "Bearer this.is.a.token",
      },
    };

    const redacted = redactDeep(payload);
    expect(redacted.password).toBe("[REDACTED_SECRET]");
    expect(redacted.nested.token).toBe("[REDACTED_SECRET]");
    expect(redacted.nested.auth).toContain("[REDACTED_SECRET]");
  });

  it("redacts valid card PAN with luhn", () => {
    const payload = {
      note: "card 4111 1111 1111 1111 should be masked",
    };
    const redacted = redactDeep(payload);
    expect(redacted.note).toContain("[REDACTED_CARD]");
  });

  it("does not aggressively redact regular numbers", () => {
    const payload = {
      note: "order 1234567890123 not a card",
    };
    const redacted = redactDeep(payload);
    expect(redacted.note).toContain("1234567890123");
  });

  it("summarizes detections", () => {
    const summary = dlpSummary({
      auth: "Bearer abc",
      cc: "4111111111111111",
    });
    expect(summary.cards).toBe(1);
    expect(summary.hasBearer).toBe(true);
  });
});
