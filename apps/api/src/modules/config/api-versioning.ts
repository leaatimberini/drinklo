import fs from "node:fs";
import path from "node:path";

export type ApiDeprecationRule = {
  deprecatedOn: string;
  sunsetOn: string;
  successor: number;
  note?: string;
};

export type ApiVersionPolicy = {
  supportedVersions: number[];
  defaultVersion: number;
  latestVersion: number;
  deprecations: Record<string, ApiDeprecationRule>;
};

const fallback: ApiVersionPolicy = {
  supportedVersions: [1, 2],
  defaultVersion: 1,
  latestVersion: 2,
  deprecations: {
    "1": {
      deprecatedOn: "2026-02-12",
      sunsetOn: "2026-08-31",
      successor: 2,
      note: "Version 1 remains supported during migration window.",
    },
  },
};

export function loadApiVersionPolicy(): ApiVersionPolicy {
  const candidates = [
    path.resolve(process.cwd(), "packages/shared/contracts/api-version-policy.json"),
    path.resolve(process.cwd(), "../../packages/shared/contracts/api-version-policy.json"),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
      const parsed = JSON.parse(raw) as ApiVersionPolicy;
      if (Array.isArray(parsed.supportedVersions) && parsed.supportedVersions.length > 0) {
        return parsed;
      }
    } catch {
      // continue to fallback
    }
  }

  return fallback;
}
