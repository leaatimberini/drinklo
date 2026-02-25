import { describe, expect, it } from "vitest";
import { buildAppPalette, resolveMobileBranding } from "../whiteLabel";

describe("mobile white-label theme", () => {
  it("applies theme token overrides with defaults", () => {
    const branding = resolveMobileBranding({
      appName: "Acme Ops",
      channel: "beta",
      themeTokens: {
        colors: {
          primary: "#2244aa",
          accent: "#ff5500",
        },
      },
    });
    const palette = buildAppPalette(branding);

    expect(branding.appName).toBe("Acme Ops");
    expect(branding.channel).toBe("beta");
    expect(palette.primary).toBe("#2244aa");
    expect(palette.accent).toBe("#ff5500");
    expect(palette.primaryText).toBe("#ffffff");
    expect(palette.radii.md).toBeGreaterThan(0);
  });
});

