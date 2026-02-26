import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function normalizeWinPath(p) {
  if (process.platform !== "win32") return p;
  return p.replace(/^\/([a-zA-Z]:\/)/, "$1");
}

export function rootPath(...parts) {
  return normalizeWinPath(path.join(ROOT_DIR, ...parts));
}

export function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

export function exists(filePath) {
  return fs.existsSync(filePath);
}

export function run(cmd, args, options = {}) {
  const isWindowsPnpm = process.platform === "win32" && cmd === "pnpm";
  const executable = isWindowsPnpm ? "pnpm" : cmd;
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? ROOT_DIR,
    stdio: options.stdio ?? "pipe",
    shell: options.shell ?? isWindowsPnpm,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
  });
  if (result.error && !options.allowFailure) {
    throw new Error(result.error.message);
  }
  if (options.allowFailure) return result;
  if (result.status !== 0) {
    const err =
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      result.error?.message ||
      `${executable} exited with ${result.status}`;
    throw new Error(err);
  }
  return result;
}

export function logInfo(message) {
  process.stdout.write(`[bootstrap] ${message}\n`);
}

export function logWarn(message) {
  process.stdout.write(`[bootstrap][warn] ${message}\n`);
}

export function logStep(message) {
  process.stdout.write(`\n==> ${message}\n`);
}

export function parseSemverMajor(value) {
  const match = String(value ?? "").match(/(\d+)\./);
  return match ? Number(match[1]) : NaN;
}

export function ensureNodeAndTools() {
  const nodeMajor = parseSemverMajor(process.versions.node);
  if (!Number.isFinite(nodeMajor) || nodeMajor < 24) {
    throw new Error(`Node >= 24 requerido. Detectado: ${process.versions.node}`);
  }
  run("pnpm", ["--version"]);
  run("docker", ["info"], { allowFailure: false });
}

function collectComposeCandidates() {
  const deployDir = rootPath("deploy");
  const candidates = [];
  if (exists(deployDir)) {
    const stack = [deployDir];
    while (stack.length) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (!entry.isFile()) continue;
        if (!/^docker-compose.*\.ya?ml$/i.test(entry.name)) continue;
        candidates.push(normalizeWinPath(full));
      }
    }
  }
  const rootCompose = rootPath("docker-compose.yml");
  if (exists(rootCompose)) candidates.push(rootCompose);
  return candidates;
}

function rankComposeCandidate(filePath, content) {
  let score = 0;
  if (/postgres:/i.test(content)) score += 50;
  if (/redis:/i.test(content)) score += 10;
  if (/minio:/i.test(content)) score += 10;
  if (/meilisearch:|typesense:/i.test(content)) score += 10;
  if (/clickhouse:/i.test(content)) score += 5;
  if (/deploy[\\/]+templates/i.test(filePath)) score += 3;
  if (/docker-compose\.yml$/i.test(filePath) && !/deploy[\\/]/i.test(filePath)) score += 20;
  if (/image:\s*erp-(api|admin|storefront|bot)/i.test(content)) score -= 40;
  return score;
}

export function detectComposeFile() {
  const override = process.env.COMPOSE_FILE?.trim();
  if (override) {
    const resolved = path.isAbsolute(override) ? override : rootPath(override);
    if (!exists(resolved)) throw new Error(`COMPOSE_FILE no existe: ${resolved}`);
    return normalizeWinPath(resolved);
  }

  const candidates = collectComposeCandidates()
    .map((file) => {
      const content = readText(file);
      return { file, content, score: rankComposeCandidate(file, content) };
    })
    .filter((row) => /postgres:/i.test(row.content));

  if (!candidates.length) {
    throw new Error("No se encontró docker-compose con postgres en /deploy ni raíz");
  }
  candidates.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
  return candidates[0].file;
}

export function dockerComposeServices(composeFile) {
  const res = run("docker", ["compose", "-f", composeFile, "config", "--services"], { allowFailure: true });
  if (res.status !== 0) return [];
  return String(res.stdout ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function selectInfraServices(serviceNames) {
  const preferred = ["postgres", "postgres-replica", "redis", "minio", "meilisearch", "typesense", "clickhouse"];
  const selected = preferred.filter((name) => serviceNames.includes(name));
  return selected.length ? selected : serviceNames;
}

export function dockerCompose(composeFile, args, options = {}) {
  return run("docker", ["compose", "-f", composeFile, ...args], options);
}

function parseComposeEnvValue(composeContent, key, fallback) {
  const regex = new RegExp(`${key}\\s*:\\s*([^\\r\\n#]+)`, "i");
  const match = composeContent.match(regex);
  if (!match) return fallback;
  return String(match[1]).trim().replace(/^["']|["']$/g, "");
}

export function waitForInfra(composeFile, timeoutMs = 120000) {
  const start = Date.now();
  const content = readText(composeFile);
  const services = dockerComposeServices(composeFile);
  const hasPostgres = services.includes("postgres");
  const hasRedis = services.includes("redis");
  const pgUser = parseComposeEnvValue(content, "POSTGRES_USER", "erp");
  const pgDb = parseComposeEnvValue(content, "POSTGRES_DB", "erp");

  const waitLoop = (label, fn) => {
    while (Date.now() - start < timeoutMs) {
      const ok = fn();
      if (ok) {
        logInfo(`${label}: OK`);
        return;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
    throw new Error(`Timeout esperando ${label}`);
  };

  if (hasPostgres) {
    waitLoop("postgres", () => {
      const res = dockerCompose(
        composeFile,
        ["exec", "-T", "postgres", "pg_isready", "-U", pgUser, "-d", pgDb],
        { allowFailure: true },
      );
      return res.status === 0;
    });
  } else {
    logWarn("Servicio postgres no encontrado en compose. Se omite wait.");
  }

  if (hasRedis) {
    waitLoop("redis", () => {
      const res = dockerCompose(composeFile, ["exec", "-T", "redis", "redis-cli", "ping"], { allowFailure: true });
      return res.status === 0 && /PONG/i.test(String(res.stdout ?? ""));
    });
  } else {
    logWarn("Servicio redis no encontrado en compose. Se omite wait.");
  }
}

export function ensureAppEnvs() {
  const appPaths = [
    "apps/api",
    "apps/admin",
    "apps/storefront",
    "apps/bot",
    "apps/control-plane",
    "apps/instance-agent",
    "apps/marketing-site",
    "apps/help-center",
    "apps/academy",
    "apps/status-page",
  ];

  for (const rel of appPaths) {
    const dir = rootPath(rel);
    if (!exists(dir)) continue;
    const envFile = path.join(dir, ".env");
    const exampleFile = path.join(dir, ".env.example");
    if (exists(envFile)) {
      logInfo(`${rel}: .env ya existe`);
      continue;
    }
    if (!exists(exampleFile)) {
      logWarn(`${rel}: no existe .env.example (skip)`);
      continue;
    }
    fs.copyFileSync(exampleFile, envFile);
    logInfo(`${rel}: .env creado desde .env.example`);
  }
}

export function rootPackageJson() {
  return JSON.parse(readText(rootPath("package.json")));
}

export function runDbMigrateAndSeed() {
  const pkg = rootPackageJson();
  const scripts = pkg.scripts ?? {};
  if (scripts["db:migrate"]) {
    run("pnpm", ["-w", "run", "db:migrate"], { stdio: "inherit" });
  } else {
    run("pnpm", ["-C", "packages/db", "exec", "prisma", "migrate", "deploy"], { stdio: "inherit" });
  }

  if (scripts["db:seed"]) {
    run("pnpm", ["-w", "run", "db:seed"], { stdio: "inherit" });
  } else {
    run("pnpm", ["-C", "packages/db", "exec", "prisma", "db", "seed"], { stdio: "inherit" });
  }
}

function readEnvFile(filePath) {
  if (!exists(filePath)) return {};
  const data = readText(filePath);
  const vars = {};
  for (const line of data.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    vars[key] = value;
  }
  return vars;
}

function detectPortFromDevScript(script) {
  const str = String(script ?? "");
  const flagMatch = str.match(/(?:^|\s)-p\s+(\d{2,5})(?:\s|$)/);
  if (flagMatch) return Number(flagMatch[1]);
  const envMatch = str.match(/\bPORT=(\d{2,5})\b/);
  if (envMatch) return Number(envMatch[1]);
  return null;
}

export function collectAppUrls() {
  const apps = [
    { rel: "apps/api", defaultPort: 3001, path: "", label: "API", envKey: "PORT" },
    { rel: "apps/admin", defaultPort: 3002, path: "", label: "Admin" },
    { rel: "apps/storefront", defaultPort: 3003, path: "", label: "Storefront" },
    { rel: "apps/bot", defaultPort: null, path: "", label: "Bot (no HTTP UI)" },
    { rel: "apps/control-plane", defaultPort: 3010, path: "", label: "Control-plane" },
    { rel: "apps/instance-agent", defaultPort: null, path: "", label: "Instance Agent (local endpoint)" },
    { rel: "apps/marketing-site", defaultPort: 3013, path: "", label: "Marketing Site" },
    { rel: "apps/help-center", defaultPort: 3014, path: "", label: "Help Center" },
    { rel: "apps/academy", defaultPort: 3016, path: "", label: "Academy" },
    { rel: "apps/status-page", defaultPort: 3015, path: "", label: "Status Page" },
  ];

  return apps
    .filter((app) => exists(rootPath(app.rel, "package.json")) || exists(rootPath(app.rel)))
    .map((app) => {
      const pkgPath = rootPath(app.rel, "package.json");
      const envPath = rootPath(app.rel, ".env");
      let port = app.defaultPort;
      if (exists(pkgPath)) {
        const pkg = JSON.parse(readText(pkgPath));
        const detected = detectPortFromDevScript(pkg?.scripts?.dev);
        if (detected) port = detected;
      }
      if (app.envKey && exists(envPath)) {
        const envVars = readEnvFile(envPath);
        if (envVars[app.envKey]) {
          const num = Number(envVars[app.envKey]);
          if (Number.isFinite(num)) port = num;
        }
      }
      return {
        label: app.label,
        rel: app.rel,
        url: port ? `http://localhost:${port}${app.path}` : null,
      };
    });
}

export function detectSeedCredentials() {
  const seedPath = rootPath("packages/db/prisma/seed.ts");
  if (!exists(seedPath)) {
    return { email: null, password: null, source: "packages/db/prisma/seed.ts no encontrado" };
  }
  const content = readText(seedPath);
  const emailMatch = content.match(/email:\s*"([^"]+@[^"]+)"/);
  const passMatch = content.match(/bcrypt\.hash\("([^"]+)"/);
  return {
    email: emailMatch?.[1] ?? null,
    password: passMatch?.[1] ?? null,
    source: "packages/db/prisma/seed.ts",
  };
}

export function printBootstrapSummary() {
  logStep("Resumen");
  for (const app of collectAppUrls()) {
    if (app.url) {
      process.stdout.write(`- ${app.label}: ${app.url}\n`);
    } else {
      process.stdout.write(`- ${app.label}: revisar package script / logs\n`);
    }
  }
  const creds = detectSeedCredentials();
  if (creds.email && creds.password) {
    process.stdout.write(`- Demo admin: ${creds.email} / ${creds.password} (${creds.source})\n`);
  } else {
    process.stdout.write(`- Credenciales demo: revisar ${creds.source}\n`);
  }
}
