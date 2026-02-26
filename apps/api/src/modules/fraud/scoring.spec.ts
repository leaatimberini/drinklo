import { calculateFraudScore } from "./scoring";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JSON fixture load without runner config changes
const fixtures = require("./__fixtures__/scoring.fixtures.json");

describe("Fraud scoring", () => {
  const base = {
    amount: 10000,
    avgAmount30d: 8000,
    ordersLast1h: 1,
    ordersLast24h: 2,
    ipOrderCountLast24h: 1,
    shippingCountry: "AR",
    geoCountry: "AR",
    paymentFailuresLast24h: 0,
    webhookErrorsLast1h: 0,
    webhookDuplicatesLast1h: 0,
    weights: {
      AMOUNT_UNUSUAL: 35,
      ORDER_FREQUENCY: 20,
      IP_GEO_RISK: 15,
      MULTIPLE_PAYMENT_FAILURES: 20,
      WEBHOOK_PATTERN: 10,
    },
    thresholds: {
      unusualAmountMultiplier: 2.5,
      minUnusualAmount: 25000,
      maxOrders1h: 3,
      maxOrders24h: 8,
      maxPaymentFailures24h: 3,
      maxWebhookErrors1h: 5,
      maxWebhookDuplicates1h: 10,
    },
  };

  it("produces deterministic HIGH score for risky fixture", () => {
    const fixture = {
      ...base,
      ...fixtures.highRisk,
    };

    const result = calculateFraudScore(fixture);
    expect(result.score).toBe(100);
    expect(result.riskLevel).toBe("HIGH");
    expect(result.action).toBe("HOLD_ORDER");
    expect(result.reasons.filter((reason) => reason.triggered).length).toBe(5);
  });

  it("produces deterministic NONE score for clean fixture", () => {
    const result = calculateFraudScore({ ...base, ...fixtures.clean });
    expect(result.score).toBe(0);
    expect(result.riskLevel).toBe("NONE");
    expect(result.action).toBe("NONE");
  });

  it("respects disabled rule weight", () => {
    const fixture = {
      ...base,
      amount: 100000,
      avgAmount30d: 10000,
      weights: {
        ...base.weights,
        AMOUNT_UNUSUAL: 0,
      },
    };

    const result = calculateFraudScore(fixture);
    expect(result.reasons.find((reason) => reason.code === "AMOUNT_UNUSUAL")?.triggered).toBe(true);
    expect(result.score).toBe(0);
    expect(result.action).toBe("NONE");
  });
});
