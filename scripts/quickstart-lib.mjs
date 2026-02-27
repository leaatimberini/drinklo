import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

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

function stringifyArgs(args) {
  return (args ?? [])
    .map((arg) => {
      const value = String(arg ?? "");
      return /\s/.test(value) ? `"${value}"` : value;
    })
    .join(" ");
}

function formatCommand(cmd, args) {
  const renderedArgs = stringifyArgs(args);
  return renderedArgs ? `${cmd} ${renderedArgs}` : String(cmd);
}

function normalizeComposeFiles(composeFiles) {
  if (Array.isArray(composeFiles)) {
    return composeFiles.map((file) => normalizeWinPath(String(file)));
  }
  return [normalizeWinPath(String(composeFiles))];
}

function composeArgs(composeFiles, args) {
  const files = normalizeComposeFiles(composeFiles);
  return [...files.flatMap((file) => ["-f", file]), ...args];
}

export function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const cwd = options.cwd ?? ROOT_DIR;
    const shell = options.shell ?? process.platform === "win32";
    const env = { ...process.env, ...(options.env ?? {}) };
    const stdio = options.stdio ?? "pipe";
    const commandText = formatCommand(cmd, args);

    const child = spawn(cmd, args, { cwd, stdio, shell, env });
    let stdout = "";
    let stderr = "";
    let settled = false;

    if (child.stdout) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
    }

    if (child.stderr) {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }

    child.on("error", (err) => {
      if (settled) return;
      settled = true;

      const diagnostic = [
        `[bootstrap][spawn-error] cmd: ${cmd}`,
        `[bootstrap][spawn-error] args: ${JSON.stringify(args ?? [])}`,
        `[bootstrap][spawn-error] cwd: ${cwd}`,
        `[bootstrap][spawn-error] code: ${err.code ?? "UNKNOWN"}`,
      ].join("\n");

      if (options.allowFailure) {
        resolve({
          status: null,
          signal: null,
          stdout,
          stderr,
          error: err,
          diagnostic,
        });
        return;
      }

      reject(new Error(`${diagnostic}\n[bootstrap][spawn-error] message: ${err.message}`));
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;

      const result = { status: code, signal, stdout, stderr, error: null };
      if (options.allowFailure) {
        resolve(result);
        return;
      }

      if (code === 0) {
        resolve(result);
        return;
      }

      if (code === null) {
        reject(
          new Error(
            [
              `[bootstrap][spawn-close] command exited with null code`,
              `[bootstrap][spawn-close] signal: ${signal ?? "none"}`,
              `[bootstrap][spawn-close] command: ${commandText}`,
              `[bootstrap][spawn-close] cwd: ${cwd}`,
            ].join("\n"),
          ),
        );
        return;
      }

      const errorMessage =
        stderr.trim() ||
        stdout.trim() ||
        `${commandText} exited with code ${code}${signal ? ` (signal ${signal})` : ""}`;
      reject(new Error(errorMessage));
    });
  });
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

export async function ensureNodeAndTools() {
  const nodeMajor = parseSemverMajor(process.versions.node);
  if (!Number.isFinite(nodeMajor) || nodeMajor < 24) {
    throw new Error(`Node >= 24 requerido. Detectado: ${process.versions.node}`);
  }
  try {
    await run("pnpm", ["--version"]);
  } catch (error) {
    throw new Error(`No se pudo ejecutar pnpm. Verifica que este en PATH.\n${error?.message ?? error}`);
  }

  try {
    await run("docker", ["info"], { allowFailure: false });
  } catch (error) {
    throw new Error(
      `Docker no esta disponible. Inicia Docker Desktop (o Docker Engine) y reintenta.\n${error?.message ?? error}`,
    );
  }
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

export async function dockerComposeServices(composeFiles) {
  const res = await run("docker", ["compose", ...composeArgs(composeFiles, ["config", "--services"])], {
    allowFailure: true,
  });
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

export function dockerCompose(composeFiles, args, options = {}) {
  return run("docker", ["compose", ...composeArgs(composeFiles, args)], options);
}

function bindingKey(binding) {
  return `${binding.service}:${binding.hostPort}:${binding.containerPort}:${binding.protocol}`;
}

function parseComposeConfigPorts(configText) {
  const lines = String(configText ?? "").split(/\r?\n/);
  const bindings = [];
  let currentService = null;
  let inPorts = false;
  let currentPort = null;

  const pushCurrentPort = () => {
    if (!currentPort) return;
    if (!Number.isFinite(currentPort.hostPort) || !Number.isFinite(currentPort.containerPort)) {
      currentPort = null;
      return;
    }
    bindings.push({
      service: currentPort.service,
      hostPort: Number(currentPort.hostPort),
      containerPort: Number(currentPort.containerPort),
      protocol: currentPort.protocol || "tcp",
    });
    currentPort = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const serviceMatch = line.match(/^\s{2}([A-Za-z0-9_.-]+):\s*$/);
    if (serviceMatch) {
      pushCurrentPort();
      currentService = serviceMatch[1];
      inPorts = false;
      continue;
    }

    if (!currentService) continue;

    if (/^\s{4}ports:\s*$/.test(line)) {
      pushCurrentPort();
      inPorts = true;
      continue;
    }

    if (/^\s{4}[^ ].*:\s*$/.test(line) && !/^\s{4}ports:\s*$/.test(line)) {
      pushCurrentPort();
      inPorts = false;
      continue;
    }

    if (!inPorts) continue;

    if (/^\s{6}-\s+/.test(line)) {
      pushCurrentPort();
      currentPort = { service: currentService, protocol: "tcp" };

      const shortPort = line.match(
        /^\s{6}-\s*"?(?<host>\d+):(?<container>\d+)(?:\/(?<protocol>tcp|udp))?"?\s*$/i,
      );
      if (shortPort?.groups) {
        currentPort.hostPort = Number(shortPort.groups.host);
        currentPort.containerPort = Number(shortPort.groups.container);
        currentPort.protocol = (shortPort.groups.protocol ?? "tcp").toLowerCase();
        pushCurrentPort();
      }
      continue;
    }

    if (!currentPort) continue;

    const published = line.match(/^\s{8}published:\s*"?(?<port>\d+)"?\s*$/);
    if (published?.groups?.port) {
      currentPort.hostPort = Number(published.groups.port);
      continue;
    }

    const target = line.match(/^\s{8}target:\s*(?<port>\d+)\s*$/);
    if (target?.groups?.port) {
      currentPort.containerPort = Number(target.groups.port);
      continue;
    }

    const protocol = line.match(/^\s{8}protocol:\s*(?<protocol>tcp|udp)\s*$/i);
    if (protocol?.groups?.protocol) {
      currentPort.protocol = protocol.groups.protocol.toLowerCase();
    }
  }

  pushCurrentPort();
  return bindings;
}

async function isHostPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ port, host: "0.0.0.0", exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function lookupWindowsPortOwner(port) {
  if (process.platform !== "win32") return null;
  const res = await run("netstat", ["-ano", "-p", "tcp"], { allowFailure: true });
  if (res.status !== 0) return null;
  const matcher = new RegExp(`:${port}\\s+[^\\r\\n]*LISTENING\\s+(\\d+)`, "i");
  for (const line of String(res.stdout ?? "").split(/\r?\n/)) {
    const match = line.match(matcher);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function resolveComposeBindings(composeFiles) {
  const res = await run("docker", ["compose", ...composeArgs(composeFiles, ["config"])], { allowFailure: true });
  if (res.status !== 0) {
    throw new Error(`No se pudo evaluar compose para preflight de puertos.\n${String(res.stderr ?? "").trim()}`);
  }
  return parseComposeConfigPorts(String(res.stdout ?? ""));
}

function preferredRemapPort(port) {
  const presets = {
    9000: 19000,
    9001: 19001,
    5432: 15432,
    6379: 16379,
    7700: 17700,
    8123: 18123,
  };
  return presets[port] ?? port + 10000;
}

async function nextAvailablePort(basePort, blockedPorts) {
  for (let candidate = basePort; candidate <= 65535; candidate += 1) {
    if (blockedPorts.has(candidate)) continue;
    // eslint-disable-next-line no-await-in-loop
    const available = await isHostPortAvailable(candidate);
    if (available) return candidate;
  }
  return null;
}

function renderPortLine(binding, remappedPort) {
  const hostPort = remappedPort ?? binding.hostPort;
  const protoSuffix = binding.protocol && binding.protocol !== "tcp" ? `/${binding.protocol}` : "";
  return `      - "${hostPort}:${binding.containerPort}${protoSuffix}"`;
}

function writeOverrideFile(overridePath, serviceBindings, remapMap) {
  const lines = ["services:"];
  const services = Array.from(serviceBindings.keys()).sort();
  for (const service of services) {
    lines.push(`  ${service}:`);
    lines.push("    ports: !override");
    for (const binding of serviceBindings.get(service)) {
      const remappedPort = remapMap.get(`${service}:${binding.hostPort}:${binding.containerPort}:${binding.protocol}`);
      lines.push(renderPortLine(binding, remappedPort));
    }
  }
  fs.writeFileSync(overridePath, `${lines.join("\n")}\n`, "utf8");
}

function rankServiceForPortRetention(service) {
  const priorities = {
    postgres: 1,
    redis: 2,
    meilisearch: 3,
    typesense: 3,
    minio: 4,
    clickhouse: 5,
  };
  return priorities[String(service ?? "").toLowerCase()] ?? 10;
}

function selectBindingToKeep(bindings) {
  if (!bindings.length) return null;
  return [...bindings].sort((a, b) => {
    const rankDiff = rankServiceForPortRetention(a.service) - rankServiceForPortRetention(b.service);
    if (rankDiff !== 0) return rankDiff;
    return String(a.service).localeCompare(String(b.service));
  })[0];
}

export async function preflightComposePorts(composeFile) {
  const composeFiles = normalizeComposeFiles(composeFile);
  const bindings = await resolveComposeBindings(composeFiles);
  const groupsByHostAndProtocol = new Map();
  for (const binding of bindings) {
    const groupKey = `${binding.hostPort}/${binding.protocol}`;
    if (!groupsByHostAndProtocol.has(groupKey)) groupsByHostAndProtocol.set(groupKey, []);
    groupsByHostAndProtocol.get(groupKey).push(binding);
  }

  const conflicts = [];
  const bindingsToRemap = [];
  for (const [groupKey, groupBindings] of groupsByHostAndProtocol.entries()) {
    const hostPort = Number(groupKey.split("/")[0]);
    const hasInternalDuplicate = groupBindings.length > 1;
    // eslint-disable-next-line no-await-in-loop
    const available = await isHostPortAvailable(hostPort);
    const isExternallyOccupied = !available;
    const keepBinding = isExternallyOccupied ? null : selectBindingToKeep(groupBindings);
    const shouldRemap = (binding) => {
      if (isExternallyOccupied) return true;
      if (!hasInternalDuplicate) return false;
      return keepBinding ? bindingKey(binding) !== bindingKey(keepBinding) : true;
    };
    if (!isExternallyOccupied && !hasInternalDuplicate) continue;

    // eslint-disable-next-line no-await-in-loop
    const pid = isExternallyOccupied ? await lookupWindowsPortOwner(hostPort) : null;
    for (const binding of groupBindings.filter((item) => shouldRemap(item))) {
      conflicts.push({
        ...binding,
        pid,
        reasons: {
          occupied: isExternallyOccupied,
          duplicate: hasInternalDuplicate,
        },
      });
      bindingsToRemap.push(binding);
    }
  }

  const overrideFile = rootPath(".bootstrap.compose.override.yml");
  if (!conflicts.length) {
    if (exists(overrideFile)) fs.rmSync(overrideFile);
    return {
      composeFiles,
      overrideFile: null,
      conflicts: [],
      remaps: [],
      finalBindings: bindings,
    };
  }

  const blockedPorts = new Set(bindings.map((binding) => binding.hostPort));
  const remapMap = new Map();
  const remaps = [];
  const orderedBindingsToRemap = [...bindingsToRemap].sort((a, b) => {
    const byPort = a.hostPort - b.hostPort;
    if (byPort !== 0) return byPort;
    const byPriority = rankServiceForPortRetention(a.service) - rankServiceForPortRetention(b.service);
    if (byPriority !== 0) return byPriority;
    return String(a.service).localeCompare(String(b.service));
  });

  for (const conflict of orderedBindingsToRemap) {
    const key = bindingKey(conflict);
    if (remapMap.has(key)) continue;
    const preferred = preferredRemapPort(conflict.hostPort);
    // eslint-disable-next-line no-await-in-loop
    const selected = await nextAvailablePort(preferred, blockedPorts);
    if (!selected) {
      throw new Error(
        `No hay puertos libres para remapear ${conflict.service} ${conflict.hostPort}:${conflict.containerPort}. Libera el puerto manualmente.`,
      );
    }
    blockedPorts.add(selected);
    remapMap.set(key, selected);
    remaps.push({
      service: conflict.service,
      fromHostPort: conflict.hostPort,
      toHostPort: selected,
      containerPort: conflict.containerPort,
      protocol: conflict.protocol,
      pid: conflict.pid ?? null,
    });
  }

  const impactedServices = new Set(remaps.map((item) => item.service));
  const serviceBindings = new Map();
  for (const binding of bindings) {
    if (!impactedServices.has(binding.service)) continue;
    if (!serviceBindings.has(binding.service)) serviceBindings.set(binding.service, []);
    serviceBindings.get(binding.service).push(binding);
  }
  writeOverrideFile(overrideFile, serviceBindings, remapMap);

  const finalBindings = bindings.map((binding) => {
    const key = bindingKey(binding);
    const mapped = remapMap.get(key);
    return mapped ? { ...binding, hostPort: mapped } : binding;
  });

  return {
    composeFiles: [...composeFiles, overrideFile],
    overrideFile,
    conflicts,
    remaps,
    finalBindings,
  };
}

export function printPortConflictSummary(plan) {
  if (!plan?.conflicts?.length) {
    logInfo("No se detectaron conflictos de puertos host.");
    return;
  }

  for (const conflict of plan.conflicts) {
    const reasons = [];
    if (conflict.reasons?.occupied) reasons.push("ocupado por otro proceso");
    if (conflict.reasons?.duplicate) reasons.push("duplicado en docker-compose");
    const reasonSuffix = reasons.length ? ` [${reasons.join(" + ")}]` : "";
    const pid = conflict.pid ? ` (PID ${conflict.pid})` : "";
    logWarn(
      `Puerto ${conflict.hostPort} en conflicto para ${conflict.service} -> ${conflict.containerPort}/${conflict.protocol}${pid}${reasonSuffix}`,
    );
  }
  logInfo("Opciones:");
  logInfo("A) liberar el puerto ocupado manualmente");
  logInfo("B) remap automatico (aplicado) usando .bootstrap.compose.override.yml");

  for (const remap of plan.remaps) {
    logInfo(
      `Remap aplicado: ${remap.service} ${remap.fromHostPort}->${remap.toHostPort} (container ${remap.containerPort}/${remap.protocol})`,
    );
  }
}

export function printInfraPortSummary(bindings) {
  const findHostPort = (serviceName, containerPort) =>
    bindings?.find((binding) => binding.service === serviceName && binding.containerPort === containerPort)?.hostPort;

  const printHttp = (serviceName, containerPort, label) => {
    const hostPort = findHostPort(serviceName, containerPort);
    if (!hostPort) return;
    process.stdout.write(`- ${label}: http://localhost:${hostPort}\n`);
  };

  const printTcp = (serviceName, containerPort, label) => {
    const hostPort = findHostPort(serviceName, containerPort);
    if (!hostPort) return;
    process.stdout.write(`- ${label}: localhost:${hostPort} (tcp)\n`);
  };

  logStep("Puertos finales de infraestructura");
  printHttp("minio", 9000, "MinIO API");
  printHttp("minio", 9001, "MinIO Console");
  printTcp("postgres", 5432, "Postgres");
  printTcp("redis", 6379, "Redis");
  printHttp("meilisearch", 7700, "Meilisearch");
  printHttp("clickhouse", 8123, "ClickHouse HTTP");
}

function parseComposeEnvValue(composeContent, key, fallback) {
  const regex = new RegExp(`${key}\\s*:\\s*([^\\r\\n#]+)`, "i");
  const match = composeContent.match(regex);
  if (!match) return fallback;
  return String(match[1]).trim().replace(/^["']|["']$/g, "");
}

export async function waitForInfra(composeFiles, timeoutMs = 120000) {
  const files = normalizeComposeFiles(composeFiles);
  const primaryComposeFile = files[0];
  const start = Date.now();
  const content = readText(primaryComposeFile);
  const services = await dockerComposeServices(files);
  const hasPostgres = services.includes("postgres");
  const hasRedis = services.includes("redis");
  const pgUser = parseComposeEnvValue(content, "POSTGRES_USER", "erp");
  const pgDb = parseComposeEnvValue(content, "POSTGRES_DB", "erp");

  const waitLoop = async (label, fn) => {
    while (Date.now() - start < timeoutMs) {
      const ok = await fn();
      if (ok) {
        logInfo(`${label}: OK`);
        return;
      }
      await sleep(1000);
    }
    throw new Error(`Timeout esperando ${label}`);
  };

  if (hasPostgres) {
    await waitLoop("postgres", async () => {
      const res = await dockerCompose(
        files,
        ["exec", "-T", "postgres", "pg_isready", "-U", pgUser, "-d", pgDb],
        { allowFailure: true },
      );
      return res.status === 0;
    });
  } else {
    logWarn("Servicio postgres no encontrado en compose. Se omite wait.");
  }

  if (hasRedis) {
    await waitLoop("redis", async () => {
      const res = await dockerCompose(files, ["exec", "-T", "redis", "redis-cli", "ping"], {
        allowFailure: true,
      });
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

export async function runDbMigrateAndSeed() {
  const pkg = rootPackageJson();
  const scripts = pkg.scripts ?? {};
  if (scripts["db:migrate"]) {
    await run("pnpm", ["-w", "run", "db:migrate"], { stdio: "inherit" });
  } else {
    await run("pnpm", ["-C", "packages/db", "exec", "prisma", "migrate", "deploy"], { stdio: "inherit" });
  }

  if (scripts["db:seed"]) {
    await run("pnpm", ["-w", "run", "db:seed"], { stdio: "inherit" });
  } else {
    await run("pnpm", ["-C", "packages/db", "exec", "prisma", "db", "seed"], { stdio: "inherit" });
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
