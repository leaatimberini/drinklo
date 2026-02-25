"use client";

export function trackMarketingEvent(event: string, props?: Record<string, unknown>) {
  const payload = {
    event,
    props: props ?? {},
    ts: new Date().toISOString(),
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
  };
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      (navigator as Navigator).sendBeacon("/api/events", blob);
      return;
    }
  } catch {
    // ignore
  }
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}
