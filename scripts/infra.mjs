import { detectComposeFile, dockerCompose, dockerComposeServices, logInfo, selectInfraServices } from "./quickstart-lib.mjs";

function usage() {
  console.error("Usage: node scripts/infra.mjs <up|down|logs>");
  process.exit(1);
}

const cmd = (process.argv[2] ?? "").trim().toLowerCase();
if (!cmd) usage();

const composeFile = detectComposeFile();
const services = dockerComposeServices(composeFile);
const infraServices = selectInfraServices(services);
logInfo(`Compose: ${composeFile}`);

if (cmd === "up") {
  dockerCompose(composeFile, ["up", "-d", ...infraServices], { stdio: "inherit" });
  process.exit(0);
}

if (cmd === "down") {
  dockerCompose(composeFile, ["down"], { stdio: "inherit" });
  process.exit(0);
}

if (cmd === "logs") {
  dockerCompose(composeFile, ["logs", "-f", ...infraServices], { stdio: "inherit" });
  process.exit(0);
}

usage();

