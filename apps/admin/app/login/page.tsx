"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { loading, initialized, user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !initialized) {
      router.replace("/install");
      return;
    }

    if (!loading && user) {
      router.replace("/");
    }
  }, [initialized, loading, router, user]);

  async function handleLogin() {
    setSubmitting(true);
    setError(null);

    const result = await login(email, password);
    if (!result.ok) {
      setError(result.message ?? "Invalid credentials");
      setSubmitting(false);
      return;
    }

    router.replace("/");
  }

  if (loading) {
    return <main style={{ padding: 32 }}>Loading login...</main>;
  }

  return (
    <main style={{ padding: 32, maxWidth: 420 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 32 }}>Admin login</h1>
      <p style={{ color: "var(--color-text-subtle)" }}>Use your company administrator credentials.</p>

      <section style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <label>
          Email
          <input
            style={{ marginTop: 8 }}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            style={{ marginTop: 8 }}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
      </section>

      {error ? <p style={{ color: "crimson", marginTop: 12 }}>{error}</p> : null}

      <button type="button" disabled={submitting || !email || !password} onClick={handleLogin} style={{ marginTop: 20 }}>
        Sign in
      </button>
    </main>
  );
}
