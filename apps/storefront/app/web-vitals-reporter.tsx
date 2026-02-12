"use client";

import { useReportWebVitals } from "next/web-vitals";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (metric.name !== "LCP" && metric.name !== "TTFB") {
      return;
    }

    fetch(`${API_URL}/public/edge/vitals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify({
        id: metric.id,
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        path: window.location.pathname,
      }),
    }).catch(() => undefined);
  });

  return null;
}
