import test from "node:test";
import assert from "node:assert/strict";

type FetchLike = typeof fetch;

test("summary proxy returns upstream payload", async () => {
  const originalFetch = global.fetch;
  const mockFetch: FetchLike = async () =>
    new Response(JSON.stringify({ status: "OPERATIONAL", statusLabel: "Operational", metrics: {}, components: [], activeIncidents: [], recentIncidents: [], generatedAt: new Date().toISOString() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  global.fetch = mockFetch;
  try {
    const mod = await import("./summary/route");
    const res = await mod.GET();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "OPERATIONAL");
  } finally {
    global.fetch = originalFetch;
  }
});

test("subscribe proxy forwards body", async () => {
  const originalFetch = global.fetch;
  const mockFetch: FetchLike = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { email?: string };
    return new Response(JSON.stringify({ ok: true, subscription: body }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  global.fetch = mockFetch;
  try {
    const mod = await import("./subscribe/route");
    const req = new Request("http://localhost/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ops@test.com" }),
    });
    const res = await mod.POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.subscription.email, "ops@test.com");
  } finally {
    global.fetch = originalFetch;
  }
});
