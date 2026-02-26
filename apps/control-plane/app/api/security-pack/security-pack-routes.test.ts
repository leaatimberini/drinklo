import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

test("security pack route denies unauthenticated access", async () => {
  const mod = await import("./route");
  const req = new NextRequest("http://localhost/api/security-pack?format=list");
  const res = await mod.GET(req);
  assert.equal(res.status, 401);
});

