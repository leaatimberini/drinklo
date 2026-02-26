import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

test("implementation route denies unauthenticated access", async () => {
  const mod = await import("./route");
  const req = new NextRequest("http://localhost/api/implementation");
  const res = await mod.GET(req);
  assert.equal(res.status, 401);
});

