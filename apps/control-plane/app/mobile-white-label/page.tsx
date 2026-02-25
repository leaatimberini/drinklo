"use client";

import { useEffect, useMemo, useState } from "react";

export default function MobileWhiteLabelPage() {
  const [instanceId, setInstanceId] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [buildProfiles, setBuildProfiles] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    appName: "ERP Mobile",
    appSlug: "erp-mobile-company",
    logoUrl: "",
    apiBaseUrl: "",
    defaultChannel: "stable",
    otaStableChannel: "stable",
    otaBetaChannel: "beta",
    themeJson: JSON.stringify(
      {
        colors: {
          primary: "#111111",
          accent: "#f97316",
        },
      },
      null,
      2,
    ),
  });
  const [buildForm, setBuildForm] = useState({ channel: "stable", appVersion: "0.1.0", runtimeVersion: "0.1.0" });
  const [otaForm, setOtaForm] = useState({ channel: "stable", targetVersion: "0.1.0", runtimeVersion: "0.1.0", message: "" });

  async function load() {
    setError(null);
    if (!instanceId.trim()) return;
    const [profilesRes, buildsRes, updatesRes] = await Promise.all([
      fetch(`/api/mobile/white-label?instanceId=${encodeURIComponent(instanceId)}`),
      fetch(`/api/mobile/white-label/build-profile?instanceId=${encodeURIComponent(instanceId)}`),
      fetch(`/api/mobile/white-label/updates?instanceId=${encodeURIComponent(instanceId)}`),
    ]);
    const [profilesData, buildsData, updatesData] = await Promise.all([
      profilesRes.json().catch(() => ({})),
      buildsRes.json().catch(() => ({})),
      updatesRes.json().catch(() => ({})),
    ]);
    if (!profilesRes.ok) throw new Error(profilesData.error ?? "No se pudieron cargar profiles");
    if (!buildsRes.ok) throw new Error(buildsData.error ?? "No se pudieron cargar build profiles");
    if (!updatesRes.ok) throw new Error(updatesData.error ?? "No se pudieron cargar OTA updates");
    setProfiles(profilesData.items ?? []);
    setBuildProfiles(buildsData.items ?? []);
    setUpdates(updatesData.items ?? []);
  }

  useEffect(() => {
    if (!instanceId) return;
    load().catch((e) => setError(e.message));
  }, [instanceId]);

  const latestProfile = useMemo(() => profiles[0] ?? null, [profiles]);

  async function saveProfile() {
    setMessage(null);
    setError(null);
    let themeTokens: any;
    try {
      themeTokens = JSON.parse(form.themeJson);
    } catch {
      setError("themeJson inválido");
      return;
    }
    const res = await fetch("/api/mobile/white-label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceId,
        appName: form.appName,
        appSlug: form.appSlug,
        logoUrl: form.logoUrl || null,
        apiBaseUrl: form.apiBaseUrl || null,
        defaultChannel: form.defaultChannel,
        otaStableChannel: form.otaStableChannel,
        otaBetaChannel: form.otaBetaChannel,
        themeTokens,
        bumpConfigVersion: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }
    setMessage("Brand profile guardado");
    await load();
  }

  async function generateBuildProfile() {
    setMessage(null);
    setError(null);
    const res = await fetch("/api/mobile/white-label/build-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceId,
        channel: buildForm.channel,
        appVersion: buildForm.appVersion,
        runtimeVersion: buildForm.runtimeVersion,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo generar build profile");
      return;
    }
    setMessage(`Build profile generado: ${data.generated?.profileName ?? data.buildProfile?.id}`);
    await load();
  }

  async function publishOta() {
    setMessage(null);
    setError(null);
    const res = await fetch("/api/mobile/white-label/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceId,
        channel: otaForm.channel,
        targetVersion: otaForm.targetVersion,
        runtimeVersion: otaForm.runtimeVersion,
        message: otaForm.message || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo publicar OTA");
      return;
    }
    setMessage(`OTA update publicado en ${data.publication?.otaChannelName ?? data.update?.channel}`);
    await load();
  }

  return (
    <main>
      <h1>White-label Mobile</h1>
      <p>Branding por empresa + build profiles + OTA channels (stable/beta).</p>
      {message ? <p style={{ color: "green" }}>{message}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Seleccionar empresa / instancia</h2>
        <label>
          Instance ID
          <input value={instanceId} onChange={(e) => setInstanceId(e.target.value)} placeholder="instance_xxx" />
        </label>
        <button onClick={() => load().catch((e) => setError(e.message))} disabled={!instanceId.trim()}>
          Cargar
        </button>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Brand profile</h2>
        <label>
          App name
          <input value={form.appName} onChange={(e) => setForm((p) => ({ ...p, appName: e.target.value }))} />
        </label>
        <label>
          App slug
          <input value={form.appSlug} onChange={(e) => setForm((p) => ({ ...p, appSlug: e.target.value }))} />
        </label>
        <label>
          Logo URL
          <input value={form.logoUrl} onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))} />
        </label>
        <label>
          API Base URL
          <input value={form.apiBaseUrl} onChange={(e) => setForm((p) => ({ ...p, apiBaseUrl: e.target.value }))} />
        </label>
        <label>
          Default channel
          <select value={form.defaultChannel} onChange={(e) => setForm((p) => ({ ...p, defaultChannel: e.target.value }))}>
            <option value="stable">stable</option>
            <option value="beta">beta</option>
          </select>
        </label>
        <label>
          Stable channel name
          <input value={form.otaStableChannel} onChange={(e) => setForm((p) => ({ ...p, otaStableChannel: e.target.value }))} />
        </label>
        <label>
          Beta channel name
          <input value={form.otaBetaChannel} onChange={(e) => setForm((p) => ({ ...p, otaBetaChannel: e.target.value }))} />
        </label>
        <label>
          Theme tokens JSON
          <textarea rows={10} value={form.themeJson} onChange={(e) => setForm((p) => ({ ...p, themeJson: e.target.value }))} />
        </label>
        <button onClick={saveProfile} disabled={!instanceId.trim()}>
          Guardar branding
        </button>
        {latestProfile ? (
          <pre style={{ background: "#f6f6f6", padding: 8, marginTop: 8 }}>{JSON.stringify(latestProfile, null, 2)}</pre>
        ) : null}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Build profile (EAS / OTA)</h2>
        <label>
          Channel
          <select value={buildForm.channel} onChange={(e) => setBuildForm((p) => ({ ...p, channel: e.target.value }))}>
            <option value="stable">stable</option>
            <option value="beta">beta</option>
          </select>
        </label>
        <label>
          App version
          <input value={buildForm.appVersion} onChange={(e) => setBuildForm((p) => ({ ...p, appVersion: e.target.value }))} />
        </label>
        <label>
          Runtime version
          <input value={buildForm.runtimeVersion} onChange={(e) => setBuildForm((p) => ({ ...p, runtimeVersion: e.target.value }))} />
        </label>
        <button onClick={generateBuildProfile} disabled={!instanceId.trim()}>
          Generar build profile
        </button>
        <ul>
          {buildProfiles.slice(0, 10).map((item) => (
            <li key={item.id}>
              {item.profileName} · {item.channel} · {item.appVersion} / {item.runtimeVersion}
            </li>
          ))}
          {buildProfiles.length === 0 ? <li>Sin build profiles.</li> : null}
        </ul>
      </section>

      <section className="card">
        <h2>OTA updates</h2>
        <label>
          Channel
          <select value={otaForm.channel} onChange={(e) => setOtaForm((p) => ({ ...p, channel: e.target.value }))}>
            <option value="stable">stable</option>
            <option value="beta">beta</option>
          </select>
        </label>
        <label>
          Target version
          <input value={otaForm.targetVersion} onChange={(e) => setOtaForm((p) => ({ ...p, targetVersion: e.target.value }))} />
        </label>
        <label>
          Runtime version
          <input value={otaForm.runtimeVersion} onChange={(e) => setOtaForm((p) => ({ ...p, runtimeVersion: e.target.value }))} />
        </label>
        <label>
          Message
          <input value={otaForm.message} onChange={(e) => setOtaForm((p) => ({ ...p, message: e.target.value }))} />
        </label>
        <button onClick={publishOta} disabled={!instanceId.trim()}>
          Publicar OTA
        </button>
        <ul>
          {updates.slice(0, 10).map((item) => (
            <li key={item.id}>
              {item.channel} · {item.targetVersion} · runtime {item.runtimeVersion} · rollout {item.rolloutChannel ?? "-"} · {item.status}
            </li>
          ))}
          {updates.length === 0 ? <li>Sin OTA updates.</li> : null}
        </ul>
      </section>
    </main>
  );
}

