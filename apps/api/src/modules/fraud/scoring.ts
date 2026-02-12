export type FraudRuleCode =
  | "AMOUNT_UNUSUAL"
  | "ORDER_FREQUENCY"
  | "IP_GEO_RISK"
  | "MULTIPLE_PAYMENT_FAILURES"
  | "WEBHOOK_PATTERN";

export type FraudReason = {
  code: FraudRuleCode;
  label: string;
  triggered: boolean;
  points: number;
  details: Record<string, any>;
};

export type ScoreInput = {
  amount: number;
  avgAmount30d: number;
  ordersLast1h: number;
  ordersLast24h: number;
  ipOrderCountLast24h: number;
  shippingCountry?: string | null;
  geoCountry?: string | null;
  paymentFailuresLast24h: number;
  webhookErrorsLast1h: number;
  webhookDuplicatesLast1h: number;
  weights: Record<FraudRuleCode, number>;
  thresholds: {
    unusualAmountMultiplier: number;
    minUnusualAmount: number;
    maxOrders1h: number;
    maxOrders24h: number;
    maxPaymentFailures24h: number;
    maxWebhookErrors1h: number;
    maxWebhookDuplicates1h: number;
  };
};

export type ScoreOutput = {
  score: number;
  riskLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  action: "NONE" | "NOTIFY_ONLY" | "REQUIRE_VERIFICATION" | "HOLD_ORDER";
  reasons: FraudReason[];
};

export function calculateFraudScore(input: ScoreInput): ScoreOutput {
  const reasons: FraudReason[] = [];

  const amountTriggered =
    input.amount >= input.thresholds.minUnusualAmount &&
    input.avgAmount30d > 0 &&
    input.amount >= input.avgAmount30d * input.thresholds.unusualAmountMultiplier;
  reasons.push({
    code: "AMOUNT_UNUSUAL",
    label: "Monto inusual",
    triggered: amountTriggered,
    points: amountTriggered ? input.weights.AMOUNT_UNUSUAL : 0,
    details: {
      amount: input.amount,
      avgAmount30d: input.avgAmount30d,
      multiplier: input.thresholds.unusualAmountMultiplier,
    },
  });

  const frequencyTriggered =
    input.ordersLast1h > input.thresholds.maxOrders1h || input.ordersLast24h > input.thresholds.maxOrders24h;
  reasons.push({
    code: "ORDER_FREQUENCY",
    label: "Frecuencia de ordenes",
    triggered: frequencyTriggered,
    points: frequencyTriggered ? input.weights.ORDER_FREQUENCY : 0,
    details: {
      ordersLast1h: input.ordersLast1h,
      ordersLast24h: input.ordersLast24h,
      maxOrders1h: input.thresholds.maxOrders1h,
      maxOrders24h: input.thresholds.maxOrders24h,
    },
  });

  const geoMismatch =
    Boolean(input.shippingCountry) &&
    Boolean(input.geoCountry) &&
    String(input.shippingCountry).toUpperCase() !== String(input.geoCountry).toUpperCase();
  const ipBurst = input.ipOrderCountLast24h >= 5;
  const geoTriggered = geoMismatch || ipBurst;
  reasons.push({
    code: "IP_GEO_RISK",
    label: "Riesgo IP/Geo",
    triggered: geoTriggered,
    points: geoTriggered ? input.weights.IP_GEO_RISK : 0,
    details: {
      shippingCountry: input.shippingCountry ?? null,
      geoCountry: input.geoCountry ?? null,
      ipOrderCountLast24h: input.ipOrderCountLast24h,
      geoMismatch,
      ipBurst,
    },
  });

  const failuresTriggered = input.paymentFailuresLast24h > input.thresholds.maxPaymentFailures24h;
  reasons.push({
    code: "MULTIPLE_PAYMENT_FAILURES",
    label: "Multiples fallos de pago",
    triggered: failuresTriggered,
    points: failuresTriggered ? input.weights.MULTIPLE_PAYMENT_FAILURES : 0,
    details: {
      paymentFailuresLast24h: input.paymentFailuresLast24h,
      maxPaymentFailures24h: input.thresholds.maxPaymentFailures24h,
    },
  });

  const webhookTriggered =
    input.webhookErrorsLast1h > input.thresholds.maxWebhookErrors1h ||
    input.webhookDuplicatesLast1h > input.thresholds.maxWebhookDuplicates1h;
  reasons.push({
    code: "WEBHOOK_PATTERN",
    label: "Patrones anormales de webhook",
    triggered: webhookTriggered,
    points: webhookTriggered ? input.weights.WEBHOOK_PATTERN : 0,
    details: {
      webhookErrorsLast1h: input.webhookErrorsLast1h,
      webhookDuplicatesLast1h: input.webhookDuplicatesLast1h,
      maxWebhookErrors1h: input.thresholds.maxWebhookErrors1h,
      maxWebhookDuplicates1h: input.thresholds.maxWebhookDuplicates1h,
    },
  });

  const score = reasons.reduce((acc, reason) => acc + reason.points, 0);

  const riskLevel: ScoreOutput["riskLevel"] =
    score >= 80 ? "HIGH" : score >= 50 ? "MEDIUM" : score >= 25 ? "LOW" : "NONE";

  const action: ScoreOutput["action"] =
    score >= 80 ? "HOLD_ORDER" : score >= 50 ? "REQUIRE_VERIFICATION" : score >= 25 ? "NOTIFY_ONLY" : "NONE";

  return { score, riskLevel, action, reasons };
}
