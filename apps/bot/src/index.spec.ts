import { describe, it, expect } from "vitest";

function parseArgs(text: string) {
  return text.split(" ").slice(1).join(" ");
}

describe("bot handlers", () => {
  it("/precio builds query", () => {
    expect(parseArgs("/precio test")).toBe("test");
  });

  it("/stock builds query", () => {
    expect(parseArgs("/stock SKU123")).toBe("SKU123");
  });

  it("/pedido_estado parses id", () => {
    expect(parseArgs("/pedido_estado order1")).toBe("order1");
  });

  it("/copiloto parses prompt", () => {
    expect(parseArgs("/copiloto crear cupon para clientes")).toBe("crear cupon para clientes");
  });
});
