import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

test("status incidents admin route denies unauthenticated access", async () => {
  const mod = await import("./incidents/route");

  const getReq = new NextRequest("http://localhost/api/status-page/incidents");
  const getRes = await mod.GET(getReq);
  assert.equal(getRes.status, 401);

  const postReq = new NextRequest("http://localhost/api/status-page/incidents", {
    method: "POST",
    body: JSON.stringify({ action: "create" }),
    headers: { "Content-Type": "application/json" },
  });
  const postRes = await mod.POST(postReq);
  assert.equal(postRes.status, 401);
});

