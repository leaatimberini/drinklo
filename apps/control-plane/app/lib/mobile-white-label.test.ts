import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExpoBuildProfile,
  buildMobileOtaPublication,
  buildWhiteLabelMobileConfig,
  normalizeOtaChannel,
} from "./mobile-white-label";

test("normalizes OTA channel using requested channel first", () => {
  assert.equal(normalizeOtaChannel("beta", "stable", "stable"), "beta");
  assert.equal(normalizeOtaChannel(undefined, "beta", "stable"), "beta");
  assert.equal(normalizeOtaChannel(undefined, undefined, "stable"), "stable");
});

test("builds white-label mobile config with merged theme and channelized OTA", () => {
  const config = buildWhiteLabelMobileConfig({
    instanceId: "inst-1",
    companyId: "c1",
    appName: "Acme Mobile",
    appSlug: "acme-mobile",
    apiBaseUrl: "https://acme.example.com/api",
    themeTokens: { colors: { primary: "#123456" } as any },
    ota: {
      requestedChannel: "beta",
      installationReleaseChannel: "stable",
      stableChannel: "wl-stable-acme",
      betaChannel: "wl-beta-acme",
      appVersion: "1.2.3",
      runtimeVersion: "1.2.3",
    },
  });

  assert.equal(config.channel, "beta");
  assert.equal(config.ota.channel, "wl-beta-acme");
  assert.equal(config.themeTokens.colors.primary, "#123456");
  assert.equal(config.themeTokens.colors.primaryText, "#ffffff");
});

test("builds expo profile and OTA publication aligned with rollout channel", () => {
  const profile = buildExpoBuildProfile({
    instanceId: "inst-1",
    appName: "Acme Mobile",
    appSlug: "acme-mobile",
    channel: "stable",
    appVersion: "2.0.0",
    runtimeVersion: "2.0.0",
    apiBaseUrl: "https://api.example.com",
    configUrl: "https://cp.example.com/api/mobile/white-label/config?instanceId=inst-1",
  });
  assert.equal(profile.eas.channel, "stable");
  assert.equal(profile.expo.extra.instanceId, "inst-1");

  const pub = buildMobileOtaPublication({
    instanceId: "inst-1",
    requestedChannel: "beta",
    installationReleaseChannel: "stable",
    stableChannel: "company-stable",
    betaChannel: "company-beta",
    targetVersion: "2.0.1",
    runtimeVersion: "2.0.0",
  });
  assert.equal(pub.channel, "beta");
  assert.equal(pub.otaChannelName, "company-beta");
  assert.equal(pub.rolloutChannel, "stable");
});

