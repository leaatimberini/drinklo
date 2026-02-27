import { spawn } from "node:child_process";
import {
  detectComposeFile,
  dockerCompose,
  dockerComposeServices,
  ensureAppEnvs,
  ensureNodeAndTools,
  logInfo,
  logWarn,
  logStep,
  preflightComposePorts,
  printInfraPortSummary,
  printPortConflictSummary,
  printBootstrapSummary,
  resolveDevServerPortOverrides,
  runDbMigrateAndSeed,
  selectInfraServices,
  waitForInfra,
} from "./quickstart-lib.mjs";

async function main() {
  logStep("Validando prerequisitos");
  await ensureNodeAndTools();
  logInfo(`Node ${process.versions.node} OK`);
  logInfo("pnpm y Docker OK");

  logStep("Detectando docker compose para infraestructura");
  const composeFile = detectComposeFile();
  logInfo(`Compose base: ${composeFile}`);

  logStep("Preflight de puertos host");
  const preflight = await preflightComposePorts(composeFile);
  printPortConflictSummary(preflight);
  if (preflight.overrideFile) {
    logInfo(`Override temporal generado: ${preflight.overrideFile}`);
  }

  const composeFiles = preflight.composeFiles;
  const services = await dockerComposeServices(composeFiles);
  const infraServices = selectInfraServices(services);
  logInfo(`Compose efectivo: ${composeFiles.join(" + ")}`);
  logInfo(`Servicios infra: ${infraServices.join(", ") || "(todos)"}`);

  logStep("Levantando infraestructura");
  await dockerCompose(composeFiles, ["up", "-d", ...infraServices], { stdio: "inherit" });

  logStep("Esperando health (postgres/redis)");
  await waitForInfra(composeFiles, 180000);

  logStep("Creando .env locales (si faltan)");
  ensureAppEnvs();

  logStep("Migraciones + seed");
  await runDbMigrateAndSeed({ composeFiles });

  printBootstrapSummary();
  printInfraPortSummary(preflight.finalBindings);

  logStep("Iniciando desarrollo (turbo)");
  const turboConcurrency = Number(process.env.TURBO_CONCURRENCY ?? 20);
  const resolvedConcurrency = Number.isFinite(turboConcurrency) && turboConcurrency > 0 ? turboConcurrency : 20;
  logInfo(`Turbo concurrency: ${resolvedConcurrency}`);
  const devPortPlan = await resolveDevServerPortOverrides();
  for (const note of devPortPlan.notes) {
    logWarn(note);
  }
  const devEnv = { ...process.env, ...devPortPlan.env };
  if (!devEnv.API_BOOTSTRAP_SAFE_MODE) {
    devEnv.API_BOOTSTRAP_SAFE_MODE = "true";
    logWarn("API bootstrap safe mode habilitado (API_BOOTSTRAP_SAFE_MODE=true) para iniciar entorno local.");
  }
  const child = spawn("pnpm", ["exec", "turbo", "dev", `--concurrency=${resolvedConcurrency}`], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: devEnv,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", (err) => {
    console.error(err);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(`[bootstrap][error] ${error?.message ?? error}`);
  process.exit(1);
});
