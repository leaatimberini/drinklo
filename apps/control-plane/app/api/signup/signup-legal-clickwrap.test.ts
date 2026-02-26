import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

test("signup route rejects trial signup without required clickwrap", async () => {
  const mod = await import("./route");
  const req = new NextRequest("http://localhost/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trial: "PROMO30",
      email: "owner@test.com",
      companyName: "Demo",
      acceptTos: false,
      acceptPrivacy: false,
    }),
  });
  const res = await mod.POST(req);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "legal_acceptance_required");
});

