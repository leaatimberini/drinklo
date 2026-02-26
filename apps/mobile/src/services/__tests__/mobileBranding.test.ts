import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearBrandingCache, downloadBrandingConfig, getCachedBrandingConfig } from "../mobileBranding";

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

describe("mobile branding config download", () => {
  beforeEach(async () => {
    mockFetch.mockReset();
    await clearBrandingCache();
  });

  it("downloads branding config and caches it", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        config: {
          appName: "Bebidas Norte",
          channel: "stable",
          configVersion: 3,
          themeTokens: { colors: { primary: "#008080" } },
          ota: { channel: "norte-stable", runtimeVersion: "1.2.0" },
        },
      }),
    );

    const result = await downloadBrandingConfig({
      configUrl: "https://cp.example.com/api/mobile/white-label/config?instanceId=inst-1",
      channel: "stable",
    });
    const cached = await getCachedBrandingConfig();

    expect(result?.appName).toBe("Bebidas Norte");
    expect(result?.theme.colors.primary).toBe("#008080");
    expect(cached?.configVersion).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toContain("channel=stable");
  });
});

