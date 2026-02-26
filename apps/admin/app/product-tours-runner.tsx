"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { selectToursForRuntime, type ProductTourDefinition, type ProductTourStepDefinition } from "@erp/shared";

type RuntimePayload = {
  tours: ProductTourDefinition[];
};

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

function getRole() {
  if (typeof window === "undefined") return "admin";
  return String((window as any).__ERP_ROLE ?? window.localStorage.getItem("erp_role") ?? "admin");
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
      surface: "ADMIN" as const,
      locale: typeof navigator !== "undefined" ? navigator.language : "es",
      role: getRole(),
      icp: getIcp(),
      path: typeof window !== "undefined" ? window.location.pathname : "/",
      trialDaysRemaining: getTrialDaysRemaining(),
      featureUsage: readFeatureUsage(),
      seenTourKeys: readTourKeys("erp_tours_seen"),
      completedTourKeys: readTourKeys("erp_tours_completed"),
    }),
    [],
  );

  const activeTours = useMemo(() => selectToursForRuntime(tours, ctx), [tours, ctx]);
  const activeTour = !dismissed ? activeTours[tourIndex] : null;
  const activeStep: ProductTourStepDefinition | null = activeTour?.steps?.[stepIndex] ?? null;

  useEffect(() => {
    const instanceId = getInstanceId();
    const q = new URLSearchParams({
      surface: "ADMIN",
      locale: String(ctx.locale ?? "es"),
      role: String(ctx.role ?? ""),
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
    if (!activeTour || !activeStep) return;
    const el = typeof document !== "undefined" ? document.querySelector(activeStep.targetSelector) : null;
    if (el instanceof HTMLElement) {
      const prevOutline = el.style.outline;
      const prevOffset = el.style.outlineOffset;
      el.style.outline = "3px solid #ef4444";
      el.style.outlineOffset = "2px";
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return () => {
        el.style.outline = prevOutline;
        el.style.outlineOffset = prevOffset;
      };
    }
    return;
  }, [activeTour?.id, activeStep?.id]);

  useEffect(() => {
    if (!activeTour || trackedStartRef.current === activeTour.id) return;
    trackedStartRef.current = activeTour.id;
    writeTourKeys("erp_tours_seen", [...(ctx.seenTourKeys ?? []), activeTour.key]);
    void fetch("/api/product-tours/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceId: getInstanceId(),
        surface: "ADMIN",
        eventType: "STARTED",
        tourId: activeTour.id,
        tourKey: activeTour.key,
        role: ctx.role,
        icp: ctx.icp,
        locale: ctx.locale,
        sessionId: sessionIdRef.current,
        stepIndex,
        stepId: activeStep?.id ?? null,
        path: ctx.path,
      }),
    }).catch(() => undefined);
  }, [activeTour, activeStep?.id, ctx, stepIndex]);

  if (!activeTour || !activeStep) return null;

  async function track(eventType: "COMPLETED" | "ABANDONED", finalStepIndex: number, finalStepId: string | null) {
    await fetch("/api/product-tours/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceId: getInstanceId(),
        surface: "ADMIN",
        eventType,
        tourId: activeTour.id,
        tourKey: activeTour.key,
        role: ctx.role,
        icp: ctx.icp,
        locale: ctx.locale,
        sessionId: sessionIdRef.current,
        stepIndex: finalStepIndex,
        stepId: finalStepId,
        path: ctx.path,
      }),
    }).catch(() => undefined);
  }

  async function next() {
    if (!activeTour) return;
    if (stepIndex + 1 < activeTour.steps.length) {
      setStepIndex((s) => s + 1);
      return;
    }
    writeTourKeys("erp_tours_completed", [...readTourKeys("erp_tours_completed"), activeTour.key]);
    await track("COMPLETED", stepIndex, activeStep.id);
    setStepIndex(0);
    setTourIndex((i) => i + 1);
    trackedStartRef.current = null;
    if (tourIndex + 1 >= activeTours.length) setDismissed(true);
  }

  async function skip() {
    await track("ABANDONED", stepIndex, activeStep.id);
    setDismissed(true);
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 9999,
        width: 360,
        maxWidth: "calc(100vw - 32px)",
        background: "#111827",
        color: "#fff",
        border: "1px solid #374151",
        borderRadius: 12,
        padding: 14,
        boxShadow: "0 10px 30px rgba(0,0,0,.35)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
        Guided Tour · {activeTour.surface} · {stepIndex + 1}/{activeTour.steps.length}
      </div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{activeStep.title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.4, opacity: 0.95 }}>{activeStep.body}</div>
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>Target: {activeStep.targetSelector}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => void skip()} style={{ padding: "6px 10px" }}>Skip</button>
        <button onClick={() => void next()} style={{ padding: "6px 10px", background: "#ef4444", color: "#fff", border: 0, borderRadius: 6 }}>
          {stepIndex + 1 < activeTour.steps.length ? "Next" : "Finish"}
        </button>
      </div>
    </div>
  );
}

