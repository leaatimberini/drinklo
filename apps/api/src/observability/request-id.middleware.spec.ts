import { requestIdMiddleware } from "../observability/request-id.middleware";

function createMock() {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (key: string, value: string) => {
      headers[key] = value;
    },
  };
  const req = { headers: {} };
  return { req, res, headers };
}

describe("requestIdMiddleware", () => {
  it("sets requestId and response header", () => {
    const { req, res, headers } = createMock();
    let called = false;
    requestIdMiddleware(req as never, res as never, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.requestId).toBeTruthy();
    expect(headers["x-request-id"]).toBe(req.requestId);
  });

  it("uses incoming x-request-id", () => {
    const { req, res, headers } = createMock();
    req.headers["x-request-id"] = "abc-123";
    requestIdMiddleware(req as never, res as never, () => undefined);
    expect(req.requestId).toBe("abc-123");
    expect(headers["x-request-id"]).toBe("abc-123");
  });
});
