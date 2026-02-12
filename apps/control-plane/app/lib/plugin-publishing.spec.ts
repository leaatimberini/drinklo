import { runPluginReview } from "./plugin-review";
import { signPluginPayload, verifyPublisherBundleSignature } from "./plugin-marketplace";

describe("plugin publishing pipeline", () => {
  it("verifies bundle signature", () => {
    const payload = {
      pluginName: "product-label",
      version: "1.0.0",
      channel: "stable",
      bundleUrl: "https://plugins.example.com/product-label-1.0.0.tgz",
      manifest: { hooks: ["onOrderCreated"] },
      requestedPermissions: ["products:read"],
      dependencies: ["zod"],
    };
    const secret = "publisher-secret";
    const signature = signPluginPayload(payload, secret);

    expect(verifyPublisherBundleSignature(payload, signature, secret)).toBe(true);
    expect(verifyPublisherBundleSignature(payload, signature, "wrong-secret")).toBe(false);
  });

  it("rejects submission with invalid permissions", () => {
    const report = runPluginReview({
      pluginName: "bad-plugin",
      version: "1.0.0",
      channel: "stable",
      bundleUrl: "https://plugins.example.com/bad-plugin.tgz",
      manifest: { hooks: ["onOrderCreated"] },
      requestedPermissions: ["root:fs"],
      dependencies: ["zod"],
    });

    expect(report.staticAnalysis.status).toBe("fail");
    expect(report.decision).toBe("REJECT");
    expect(report.staticAnalysis.invalidPermissions).toContain("root:fs");
  });

  it("rejects submission on blocked dependency policy", () => {
    const report = runPluginReview({
      pluginName: "shell-plugin",
      version: "1.0.0",
      channel: "stable",
      bundleUrl: "https://plugins.example.com/shell-plugin.tgz",
      manifest: { hooks: ["onOrderCreated"] },
      requestedPermissions: ["products:read"],
      dependencies: ["shelljs"],
    });

    expect(report.staticAnalysis.status).toBe("fail");
    expect(report.staticAnalysis.blockedDependencies).toContain("shelljs");
    expect(report.decision).toBe("REJECT");
  });
});
