import { signPayload, verifySignature } from "./signing";
import { validateHeartbeat } from "./payload";

describe("instance-agent payload", () => {
  it("validates required fields", () => {
    expect(() => validateHeartbeat({
      instance_id: "inst-1",
      db_ok: true,
      redis_ok: true,
      storage_ok: true,
      jobs_failed: 0,
    })).not.toThrow();
  });

  it("signs and verifies payload", () => {
    const payload = JSON.stringify({ hello: "world" });
    const secret = "secret";
    const sig = signPayload(payload, secret);
    expect(verifySignature(payload, secret, sig)).toBe(true);
  });
});
