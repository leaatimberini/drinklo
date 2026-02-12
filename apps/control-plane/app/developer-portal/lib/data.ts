import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const portalDataDir = path.join(root, "apps", "control-plane", "public", "developer-api");

export type ApiCatalog = {
  generatedAt: string;
  version: string;
  title: string;
  endpointCount: number;
  endpoints: Array<{
    method: string;
    route: string;
    operationId: string;
    source: string | null;
  }>;
};

export type ApiChangelog = {
  generatedAt: string;
  entries: Array<{ sha: string; date: string; subject: string }>;
};

function readJson<T>(name: string, fallback: T): T {
  const filePath = path.join(portalDataDir, name);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function readPortalIndex() {
  return readJson("index.json", { generatedAt: null, versions: [] as Array<{ version: string; endpointCount: number; title: string }> });
}

export function readCatalog(version: "v1" | "v2"): ApiCatalog {
  return readJson(`${version}.catalog.json`, {
    generatedAt: new Date(0).toISOString(),
    version,
    title: `ERP API ${version.toUpperCase()}`,
    endpointCount: 0,
    endpoints: [],
  });
}

export function readChangelog(): ApiChangelog {
  return readJson("changelog.json", {
    generatedAt: new Date(0).toISOString(),
    entries: [],
  });
}
