import test from "node:test";
import assert from "node:assert/strict";

test("pricing proxy endpoint returns control-plane payload", async () => {
  const originalFetch = global.fetch;
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ snapshot: [], tiers: [{ tier: "C1" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  global.fetch = fakeFetch;
  try {
    const mod = await import("./pricing/route");
    const res = await mod.GET();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(Array.isArray(body.tiers), true);
  } finally {
    global.fetch = originalFetch;
  }
});

test("events endpoint accepts basic analytics payload", async () => {
  const mod = await import("./events/route");
  const req = new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "page_view", props: { page: "home" } }),
  });
  const res = await mod.POST(req as unknown as import("next/server").NextRequest);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.event, "page_view");
});
