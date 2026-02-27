import process from "node:process";
import { logInfo, logStep, run } from "./quickstart-lib.mjs";

function commandLocator() {
  return process.platform === "win32"
    ? { cmd: "where", args: ["pnpm"] }
    : { cmd: "which", args: ["pnpm"] };
}

async function main() {
  logStep("Bootstrap diagnostics");
  logInfo(`Platform: ${process.platform}`);
  logInfo(`Node: ${process.version}`);
  logInfo(`Node binary: ${process.execPath}`);

  const locator = commandLocator();
  const wherePnpm = await run(locator.cmd, locator.args, { allowFailure: true });
  if (wherePnpm.status !== 0) {
    throw new Error(
      [
        "No se encontro pnpm en PATH.",
        `Comando ejecutado: ${locator.cmd} ${locator.args.join(" ")}`,
        String(wherePnpm.stderr ?? "").trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const foundPaths = String(wherePnpm.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  logInfo(`pnpm path(s): ${foundPaths.join(", ")}`);

  const pnpmVersion = await run("pnpm", ["-v"], { allowFailure: true });
  if (pnpmVersion.status !== 0) {
    const details = [
      "No se pudo ejecutar `pnpm -v`.",
      `status: ${pnpmVersion.status}`,
      `signal: ${pnpmVersion.signal ?? "none"}`,
      String(pnpmVersion.stderr ?? "").trim(),
      String(pnpmVersion.stdout ?? "").trim(),
    ]
      .filter(Boolean)
      .join("\n");
    throw new Error(details);
  }

  logInfo(`pnpm version: ${String(pnpmVersion.stdout ?? "").trim()}`);
  logInfo("bootstrap:diag OK");
}

main().catch((error) => {
  console.error(`[bootstrap:diag][error] ${error?.message ?? error}`);
  process.exit(1);
});
