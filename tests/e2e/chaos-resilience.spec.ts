import { expect, test } from "@playwright/test";

test.describe("chaos reporting", () => {
  test("control-plane exposes chaos trends endpoint", async ({ request }) => {
    const cpUrl = process.env.CHAOS_CONTROL_PLANE_URL;
    const adminToken = process.env.CHAOS_CONTROL_PLANE_ADMIN_TOKEN;

    test.skip(!cpUrl || !adminToken, "requires CHAOS_CONTROL_PLANE_URL and CHAOS_CONTROL_PLANE_ADMIN_TOKEN");

    const res = await request.get(`${cpUrl.replace(/\/$/, "")}/api/chaos/results?days=7`, {
      headers: {
        "x-cp-admin-token": adminToken,
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.runs)).toBeTruthy();
    expect(Array.isArray(body.trends)).toBeTruthy();
  });
});
