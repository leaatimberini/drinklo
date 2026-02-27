"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-provider";

type InstallPayload = {
  companyName: string;
  adminEmail: string;
  adminPassword: string;
  themeAdmin: "A" | "B" | "C";
  themeStorefront: "A" | "B" | "C";
};

const steps = ["Company", "Admin", "Themes"] as const;

export default function InstallPage() {
  const router = useRouter();
  const { initialized, loading, refreshMe } = useAuth();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<InstallPayload>({
    companyName: "",
    adminEmail: "",
    adminPassword: "",
    themeAdmin: "A",
    themeStorefront: "A",
  });

  useEffect(() => {
    if (!loading && initialized) {
      router.replace("/login");
    }
  }, [initialized, loading, router]);

  const step = steps[stepIndex];

  const canContinue = useMemo(() => {
    if (step === "Company") {
      return payload.companyName.trim().length >= 2;
    }
    if (step === "Admin") {
      return payload.adminEmail.includes("@") && payload.adminPassword.length >= 6;
    }
    return true;
  }, [payload, step]);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/installer/bootstrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Bootstrap failed");
      }

      await refreshMe();
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main style={{ padding: 32 }}>Loading installer...</main>;
  }

  return (
    <main style={{ padding: 32, maxWidth: 560 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 32 }}>Initial installation</h1>
      <p style={{ color: "var(--color-text-subtle)" }}>
        Step {stepIndex + 1} of {steps.length}: {step}
      </p>

      {step === "Company" && (
        <label style={{ display: "block", marginTop: 24 }}>
          Company name
          <input
            style={{ marginTop: 8 }}
            value={payload.companyName}
            onChange={(event) => setPayload((prev) => ({ ...prev, companyName: event.target.value }))}
          />
        </label>
      )}

      {step === "Admin" && (
        <section style={{ marginTop: 24, display: "grid", gap: 12 }}>
          <label>
            Admin email
            <input
              style={{ marginTop: 8 }}
              type="email"
              value={payload.adminEmail}
              onChange={(event) => setPayload((prev) => ({ ...prev, adminEmail: event.target.value }))}
            />
          </label>
          <label>
            Admin password
            <input
              style={{ marginTop: 8 }}
              type="password"
              value={payload.adminPassword}
              onChange={(event) => setPayload((prev) => ({ ...prev, adminPassword: event.target.value }))}
            />
          </label>
        </section>
      )}

      {step === "Themes" && (
        <section style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Admin theme
            <select
              value={payload.themeAdmin}
              onChange={(event) =>
                setPayload((prev) => ({ ...prev, themeAdmin: event.target.value as InstallPayload["themeAdmin"] }))
              }
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </label>
          <label>
            Storefront theme
            <select
              value={payload.themeStorefront}
              onChange={(event) =>
                setPayload((prev) => ({
                  ...prev,
                  themeStorefront: event.target.value as InstallPayload["themeStorefront"],
                }))
              }
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </label>
        </section>
      )}

      {error ? <p style={{ color: "crimson", marginTop: 12 }}>{error}</p> : null}

      <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
        <button
          type="button"
          onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
          disabled={stepIndex === 0 || submitting}
        >
          Back
        </button>
        {stepIndex < steps.length - 1 ? (
          <button
            type="button"
            disabled={!canContinue || submitting}
            onClick={() => setStepIndex((value) => Math.min(steps.length - 1, value + 1))}
          >
            Continue
          </button>
        ) : (
          <button type="button" disabled={!canContinue || submitting} onClick={onSubmit}>
            Complete installation
          </button>
        )}
      </div>
    </main>
  );
}
