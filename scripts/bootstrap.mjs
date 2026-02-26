import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ps1 = path.join(__dirname, "bootstrap.ps1");
const sh = path.join(__dirname, "bootstrap.sh");

const child =
  process.platform === "win32"
    ? spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File", ps1, ...process.argv.slice(2)], {
        stdio: "inherit",
      })
    : spawn("bash", [sh, ...process.argv.slice(2)], {
        stdio: "inherit",
      });

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

