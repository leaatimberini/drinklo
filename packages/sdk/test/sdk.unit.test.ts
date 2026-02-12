import assert from "node:assert/strict";
import test from "node:test";
import { ErpSdkClient } from "../src/client";
import { createIdempotencyKey } from "../src/helpers";

test("retries on 500 and succeeds", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ message: "temporary" }), { status: 500, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 50 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const client = new ErpSdkClient({
    baseUrl: "https://api.example.com",
    apiKey: "dpk_x.y",
    fetchImpl,
    retry: { maxRetries: 1, backoffMs: 1 },
  });

  const result = await client.listProducts();
  assert.equal(result.total, 0);
  assert.equal(calls, 2);
});

test("pagination helper yields all products", async () => {
  const fetchImpl: typeof fetch = async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "2");

    const all = [{ id: "p1", name: "A" }, { id: "p2", name: "B" }, { id: "p3", name: "C" }];
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);

    return new Response(JSON.stringify({ items, total: all.length, page, pageSize }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const client = new ErpSdkClient({ baseUrl: "https://api.example.com", apiKey: "dpk_x.y", fetchImpl });

  const names: string[] = [];
  for await (const item of client.paginateProducts({ pageSize: 2 })) {
    names.push(item.name as string);
  }

  assert.deepEqual(names, ["A", "B", "C"]);
});

test("idempotency key helper returns non-empty value", () => {
  const key = createIdempotencyKey("sdk-test");
  assert.ok(key.startsWith("sdk-test-"));
  assert.ok(key.length > 20);
});
