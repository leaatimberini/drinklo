import { applyJsonMapping, computeRetryBackoffMs } from "./integration-builder.service";

describe("IntegrationBuilder mapping", () => {
  it("maps fields from event payload and interpolates secrets", () => {
    const mapped = applyJsonMapping(
      {
        eventId: "$.id",
        orderId: "$.payload.orderId",
        nested: {
          source: "$.source",
          auth: "Bearer {{secret.token}}",
          url: "https://x/{{event.payload.orderId}}",
        },
      },
      {
        event: {
          id: "evt1",
          source: "api",
          payload: { orderId: "ord1" },
        },
        secret: { token: "abc123" },
      },
    );

    expect(mapped).toEqual({
      eventId: "evt1",
      orderId: "ord1",
      nested: {
        source: "api",
        auth: "Bearer abc123",
        url: "https://x/ord1",
      },
    });
  });

  it("computes exponential backoff", () => {
    expect(computeRetryBackoffMs(1000, 1)).toBe(1000);
    expect(computeRetryBackoffMs(1000, 2)).toBe(2000);
    expect(computeRetryBackoffMs(1000, 3)).toBe(4000);
  });
});

