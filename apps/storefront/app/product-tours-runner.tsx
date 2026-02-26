"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { selectToursForRuntime, type ProductTourDefinition, type ProductTourStepDefinition } from "@erp/shared";

type RuntimePayload = { tours: ProductTourDefinition[] };

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getInstanceId() {
  if (typeof window === "undefined") return null;
  return (
    (window as any).__ERP_INSTANCE_ID ??
    window.localStorage.getItem("erp_instance_id") ??
    process.env.NEXT_PUBLIC_INSTANCE_ID ??
    null
  );
}

function getIcp() {
  if (typeof window === "undefined") return null;
  return String((window as any).__ERP_ICP ?? window.localStorage.getItem("erp_icp") ?? "");
}

function getTrialDaysRemaining() {
  if (typeof window === "undefined") return null;
  const value = (window as any).__ERP_TRIAL_DAYS_REMAINING ?? window.localStorage.getItem("erp_trial_days_remaining");
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readFeatureUsage() {
  if (typeof window === "undefined") return {};
  return parseJson<Record<string, number>>(window.localStorage.getItem("erp_feature_usage"), {});
}

function readTourKeys(storageKey: string) {
  if (typeof window === "undefined") return [];
  return parseJson<string[]>(window.localStorage.getItem(storageKey), []);
}

function writeTourKeys(storageKey: string, values: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(Array.from(new Set(values))));
}

export function ProductToursRunner() {
  const [tours, setTours] = useState<ProductTourDefinition[]>([]);
  const [tourIndex, setTourIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const sessionIdRef = useRef<string>(`tour-${Math.random().toString(36).slice(2, 10)}`);
  const trackedStartRef = useRef<string | null>(null);

  const ctx = useMemo(
    () => ({
      surface: "STOREFRONT" as const,
      locale: typeof navigator !== "undefined" ? navigator.language : "es",
      role: "customer",
      icp: getIcp(),
      path: typeof window !== "undefined" ? window.location.pathname : "/",
      trialDaysRemaining: getTrialDaysRemaining(),
      featureUsage: readFeatureUsage(),
      seenTourKeys: readTourKeys("erp_tours_seen_storefront"),
      completedTourKeys: readTourKeys("erp_tours_completed_storefront"),
    }),
    [],
  );

  const activeTours = useMemo(() => selectToursForRuntime(tours, ctx), [tours, ctx]);
  const activeTour = !dismissed ? activeTours[tourIndex] : null;
  const activeStep: ProductTourStepDefinition | null = activeTour?.steps?.[stepIndex] ?? null;

  useEffect(() => {
    const instanceId = getInstanceId();
    const q = new URLSearchParams({
      surface: "STOREFRONT",
      locale: String(ctx.locale ?? "es"),
      role: "customer",
      icp: String(ctx.icp ?? ""),
      path: String(ctx.path ?? "/"),
      featureUsage: JSON.stringify(ctx.featureUsage ?? {}),
      seen: (ctx.seenTourKeys ?? []).join(","),
      completed: (ctx.completedTourKeys ?? []).join(","),
    });
    if (ctx.trialDaysRemaining != null) q.set("trialDaysRemaining", String(ctx.trialDaysRemaining));
    if (instanceId) q.set("instanceId", String(instanceId));
    fetch(`/api/product-tours?${q.toString()}`)
      .then((res) => res.json())
      .then((payload: RuntimePayload) => setTours(Array.isArray(payload.tours) ? payload.tours : []))
      .catch(() => undefined);
  }, [ctx]);

  useEffect(() => {
    if (!activeStep) return;
    const el = typeof document !== "undefined" ? document.querySelector(activeStep.targetSelector) : null;
    if (el instanceof HTMLElement) {
      const prevOutline = el.style.outline;
      const prevOffset = el.style.outlineOffset;
      el.style.outline = "3px solid #22c55e";
      el.style.outlineOffset = "2px";
      return () => {
        el.style.outline = prevOutline;
        el.style.outlineOffset = prevOffset;
      };
    }
    return;
  }, [activeStep?.id]);

  useEffect(() => {
    if (!activeTour || !activeStep || trackedStartRef.current === activeTour.id) return;
    trackedStartRef.current = activeTour.id;
    writeTourKeys("erp_tours_seen_storefront", [...(ctx.seenTourKeys ?? []), activeTour.key]);
    void fetch("/api/product-tours/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceId: getInstanceId(),
        surface: "STOREFRONT",
        eventType: "STARTED",
        tourId: activeTour.id,
        tourKey: activeTour.key,
        locale: ctx.locale,
        icp: ctx.icp,
        sessionId: sessionIdRef.current,
        stepIndex,
        stepId: activeStep.id,
        path: ctx.path,
      }),
    }).catch(() => undefined);
  }, [activeTour, activeStep, ctx, stepIndex]);

  if (!activeTour || !activeStep) return null;

  async function track(eventType: "COMPLETED" | "ABANDONED") {
    await fetch("/api/product-tours/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceId: getInstanceId(),
        surface: "STOREFRONT",
        eventType,
        tourId: activeTour.id,
        tourKey: activeTour.key,
        locale: ctx.locale,
        icp: ctx.icp,
        sessionId: sessionIdRef.current,
        stepIndex,
        stepId: activeStep.id,
        path: ctx.path,
      }),
    }).catch(() => undefined);
  }

  async function next() {
    if (stepIndex + 1 < activeTour.steps.length) {
      setStepIndex((s) => s + 1);
      return;
    }
    writeTourKeys("erp_tours_completed_storefront", [...readTourKeys("erp_tours_completed_storefront"), activeTour.key]);
    await track("COMPLETED");
    setStepIndex(0);
    setTourIndex((i) => i + 1);
    trackedStartRef.current = null;
    if (tourIndex + 1 >= activeTours.length) setDismissed(true);
  }

  async function skip() {
    await track("ABANDONED");
    setDismissed(true);
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        zIndex: 9999,
        width: 340,
        maxWidth: "calc(100vw - 32px)",
        background: "#052e16",
        color: "#fff",
        border: "1px solid #166534",
        borderRadius: 12,
        padding: 14,
        boxShadow: "0 10px 30px rgba(0,0,0,.35)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
        Tour · Storefront · {stepIndex + 1}/{activeTour.steps.length}
      </div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{activeStep.title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.4 }}>{activeStep.body}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => void skip()} style={{ padding: "6px 10px" }}>Skip</button>
        <button onClick={() => void next()} style={{ padding: "6px 10px", background: "#22c55e", color: "#052e16", border: 0, borderRadius: 6 }}>
          {stepIndex + 1 < activeTour.steps.length ? "Next" : "Finish"}
        </button>
      </div>
    </div>
  );
}

