import { signDeveloperWebhook, verifyDeveloperWebhookSignature } from "./developer-api.crypto";

describe("developer-api crypto", () => {
  it("creates and verifies webhook signature", () => {
    const secret = "test-secret";
    const payload = JSON.stringify({ event: "OrderCreated", orderId: "o1" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDeveloperWebhook(secret, payload, timestamp);

    expect(verifyDeveloperWebhookSignature(secret, payload, signature)).toBe(true);
  });

  it("rejects invalid signature", () => {
    const secret = "test-secret";
    const payload = JSON.stringify({ event: "OrderCreated", orderId: "o1" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDeveloperWebhook(secret, payload, timestamp);

    expect(verifyDeveloperWebhookSignature("other-secret", payload, signature)).toBe(false);
  });
});
