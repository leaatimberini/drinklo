import { describe, expect, it, vi } from "vitest";
import { listOrders, login, lookupStock, receiveStock, updateOrderStatus } from "../api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockResponse(body: any, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe("mobile api service", () => {
  it("logs in", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ accessToken: "token", user: { id: "u1", email: "a", name: "n", role: "admin" } }));
    const res = await login("a", "b");
    expect(res.accessToken).toBe("token");
  });

  it("looks up stock", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ productId: "p1", variantId: "v1", name: "Agua", sku: "AG-1", price: 100, stock: 5 }),
    );
    const res = await lookupStock("token", "AG-1");
    expect(res.sku).toBe("AG-1");
  });

  it("receives stock", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));
    await receiveStock("token", { variantId: "v1", locationId: "l1", quantity: 10, reason: "receive" });
    expect(mockFetch).toHaveBeenCalled();
  });

  it("lists orders", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: "o1" }]));
    const res = await listOrders("token", "PAID");
    expect(res[0].id).toBe("o1");
  });

  it("updates status", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));
    await updateOrderStatus("token", "o1", { status: "PACKED" });
    expect(mockFetch).toHaveBeenCalled();
  });
});
