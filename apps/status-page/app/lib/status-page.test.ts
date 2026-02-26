import test from "node:test";
import assert from "node:assert/strict";
import { buildControlPlaneUrl, fallbackSummary, statusBadgeColor } from "./status-page";

test("buildControlPlaneUrl trims slashes", () => {
  const prev = process.env.CONTROL_PLANE_URL;
  process.env.CONTROL_PLANE_URL = "http://localhost:3010/";
  assert.equal(buildControlPlaneUrl("/api/status-page/public/summary"), "http://localhost:3010/api/status-page/public/summary");
  process.env.CONTROL_PLANE_URL = prev;
});

test("status badge colors map known levels", () => {
  assert.equal(statusBadgeColor("OPERATIONAL"), "#15803d");
  assert.equal(statusBadgeColor("DEGRADED"), "#b45309");
  assert.equal(statusBadgeColor("PARTIAL_OUTAGE"), "#c2410c");
  assert.equal(statusBadgeColor("MAJOR_OUTAGE"), "#b91c1c");
});

test("fallback summary is degraded placeholder", () => {
  const fb = fallbackSummary();
  assert.equal(fb.status, "DEGRADED");
  assert.equal(Array.isArray(fb.components), true);
});

