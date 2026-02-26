import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

test("outbound sequences admin route denies unauthenticated access", async () => {
  const mod = await import("./route");
  const req = new NextRequest("http://localhost/api/outbound-sequences");
  const res = await mod.GET(req);
  assert.equal(res.status, 401);
});

test("public open tracking route returns pixel without token", async () => {
  const mod = await import("./track/open/route");
  const req = new NextRequest("http://localhost/api/outbound-sequences/track/open");
  const res = await mod.GET(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/gif");
});

test("public click tracking route redirects with fallback", async () => {
  const mod = await import("./track/click/route");
  const req = new NextRequest("http://localhost/api/outbound-sequences/track/click?u=https%3A%2F%2Fexample.com");
  const res = await mod.GET(req);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://example.com/");
});

test("unsubscribe route requires email param", async () => {
  const mod = await import("./unsubscribe/route");
  const req = new NextRequest("http://localhost/api/outbound-sequences/unsubscribe");
  const res = await mod.GET(req);
  assert.equal(res.status, 400);
});

