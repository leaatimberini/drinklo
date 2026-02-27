import { detectComposeFile, dockerCompose, dockerComposeServices, logInfo, selectInfraServices } from "./quickstart-lib.mjs";

function usage() {
  console.error("Usage: node scripts/infra.mjs <up|down|logs>");
  process.exit(1);
}

async function main() {
  const cmd = (process.argv[2] ?? "").trim().toLowerCase();
  if (!cmd) usage();

  const composeFile = detectComposeFile();
  const services = await dockerComposeServices(composeFile);
  const infraServices = selectInfraServices(services);
  logInfo(`Compose: ${composeFile}`);

  if (cmd === "up") {
    await dockerCompose(composeFile, ["up", "-d", ...infraServices], { stdio: "inherit" });
    return;
  }

  if (cmd === "down") {
    await dockerCompose(composeFile, ["down"], { stdio: "inherit" });
    return;
  }

  if (cmd === "logs") {
    await dockerCompose(composeFile, ["logs", "-f", ...infraServices], { stdio: "inherit" });
    return;
  }

  usage();
}

main().catch((error) => {
  console.error(`[infra][error] ${error?.message ?? error}`);
  process.exit(1);
});
