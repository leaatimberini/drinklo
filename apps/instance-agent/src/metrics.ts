type MetricsSummary = {
  p95Ms?: number;
  errorRate?: number;
  webhookRetryRate?: number;
};

function parseLabels(segment: string) {
  const labels: Record<string, string> = {};
  const trimmed = segment.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return labels;
  const content = trimmed.slice(1, -1);
  const parts = content.length ? content.split(",") : [];
  for (const part of parts) {
    const [rawKey, rawValue] = part.split("=");
    if (!rawKey || !rawValue) continue;
    const key = rawKey.trim();
    const value = rawValue.trim().replace(/^\"|\"$/g, "");
    labels[key] = value;
  }
  return labels;
}

export function parseMetricsSummary(text: string): MetricsSummary {
  let p95Ms: number | undefined;
  let totalRequests = 0;
  let errorRequests = 0;
  let webhooksTotal = 0;
  let webhookRetries = 0;

  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [metricPart, valuePart] = trimmed.split(" ");
    if (!metricPart || !valuePart) continue;
    const value = Number(valuePart);
    if (!Number.isFinite(value)) continue;

    const hasLabels = metricPart.includes("{");
    const name = hasLabels ? metricPart.split("{")[0] : metricPart;
    const labels = hasLabels ? parseLabels(metricPart.slice(metricPart.indexOf("{"))) : {};

    if (name === "http_request_duration_ms" && labels.quantile === "0.95") {
      p95Ms = value;
    }

    if (name === "http_requests_total") {
      totalRequests += value;
      const status = labels.status ?? "";
      if (status.startsWith("5")) {
        errorRequests += value;
      }
    }

    if (name === "webhooks_total") {
      webhooksTotal += value;
    }
    if (name === "webhook_retries_total") {
      webhookRetries += value;
    }
  }

  const errorRate = totalRequests > 0 ? errorRequests / totalRequests : undefined;
  const webhookRetryRate = webhooksTotal > 0 ? webhookRetries / webhooksTotal : undefined;

  return {
    p95Ms,
    errorRate,
    webhookRetryRate,
  };
}
