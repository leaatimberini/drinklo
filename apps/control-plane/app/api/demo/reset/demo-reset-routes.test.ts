import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

test("demo reset route denies unauthenticated access", async () => {
  const mod = await import("./route");
  const req = new NextRequest("http://localhost/api/demo/reset", { method: "POST" });
  const res = await mod.POST(req);
  assert.equal(res.status, 401);
});

