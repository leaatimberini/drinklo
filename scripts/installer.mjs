import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const marker = path.join(root, "deploy", ".installed");

if (fs.existsSync(marker)) {
  console.log("Installer already completed.");
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

(async () => {
  const domain = (await ask("Domain (base): ")).trim();
  const company = (await ask("Company name: ")).trim();
  const adminEmail = (await ask("Admin email: ")).trim();
  const adminPassword = (await ask("Admin password: ")).trim();
  rl.close();

  const envTemplate = fs.readFileSync(path.join(root, "deploy", "templates", ".env.template"), "utf8");
  const env = envTemplate
    .replace(/\{\{DOMAIN_API\}\}/g, `${domain}`)
    .replace(/\{\{DOMAIN_ADMIN\}\}/g, `${domain}`)
    .replace(/\{\{DOMAIN_STOREFRONT\}\}/g, `${domain}`)
    .replace(/\{\{ADMIN_EMAIL\}\}/g, adminEmail)
    .replace(/\{\{ADMIN_PASSWORD\}\}/g, adminPassword);

  fs.writeFileSync(path.join(root, "deploy", ".env"), env);

  const composeTemplate = fs.readFileSync(path.join(root, "deploy", "templates", "docker-compose.yml"), "utf8");
  fs.writeFileSync(path.join(root, "deploy", "docker-compose.yml"), composeTemplate);

  const composeResult = spawnSync("docker", ["compose", "-f", "deploy/docker-compose.yml", "up", "-d"], {
    stdio: "inherit",
    shell: true,
  });
  if (composeResult.status !== 0) {
    process.exit(composeResult.status ?? 1);
  }

  const res = await fetch("http://localhost:3001/setup/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: company,
      brandName: company,
      domain,
      adminName: "Admin",
      adminEmail,
      adminPassword,
    }),
  });

  if (!res.ok) {
    const payload = await res.text();
    console.error("Setup failed", payload);
    process.exit(1);
  }

  fs.writeFileSync(marker, new Date().toISOString());
  console.log("Installation complete.");
})();
