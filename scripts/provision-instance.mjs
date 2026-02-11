import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import readline from "node:readline";

const args = process.argv.slice(2);
const flags = new Map();
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg.startsWith("--")) {
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      i += 1;
    } else {
      flags.set(key, "true");
    }
  }
}

function getFlag(key, fallback) {
  return flags.has(key) ? flags.get(key) : fallback;
}

function randomSecret(len = 32) {
  return crypto.randomBytes(len).toString("hex");
}

async function prompt(question, fallback) {
  if (fallback) return fallback;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return String(answer).trim();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true, ...options });
  if (result.status !== 0) {
    throw new Error(`${command} failed`);
  }
}

async function waitForHealth(url, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

async function main() {
  const instanceName = await prompt("Instance name: ", getFlag("name"));
  if (!instanceName) throw new Error("Instance name required");

  const domain = await prompt("Base domain (e.g. example.com): ", getFlag("domain"));
  if (!domain) throw new Error("Domain required");

  const companyName = await prompt("Company name: ", getFlag("company") ?? "ERP Company");
  const brandName = await prompt("Brand name: ", getFlag("brand") ?? companyName);
  const adminName = await prompt("Admin name: ", getFlag("admin-name") ?? "Admin");
  const adminEmail = await prompt("Admin email: ", getFlag("admin-email") ?? "admin@" + domain);
  const adminPassword = await prompt("Admin password: ", getFlag("admin-password") ?? "admin123");

  const adminDomain = getFlag("admin-domain", `admin.${domain}`);
  const apiDomain = getFlag("api-domain", `api.${domain}`);
  const storefrontDomain = getFlag("storefront-domain", domain);

  const apiPort = Number(getFlag("api-port", "3001"));
  const adminPort = Number(getFlag("admin-port", "3002"));
  const storefrontPort = Number(getFlag("storefront-port", "3003"));
  const botPort = Number(getFlag("bot-port", "3004"));
  const dbPort = Number(getFlag("db-port", "5432"));
  const redisPort = Number(getFlag("redis-port", "6379"));

  const seed = getFlag("seed", "false") === "true";
  const starterPack = getFlag("starter-pack", "false") === "true";
  const productPackage = getFlag("product-package", "");

  const instanceDir = path.join("deploy", "instances", instanceName);
  fs.mkdirSync(instanceDir, { recursive: true });

  const templateDir = path.join("deploy", "templates");
  const templateEnv = fs.readFileSync(path.join(templateDir, ".env.template"), "utf8");
  const templateCompose = fs.readFileSync(path.join(templateDir, "docker-compose.yml"), "utf8");

  const jwtSecret = getFlag("jwt-secret", randomSecret(16));
  const brandingSecret = getFlag("branding-secret", randomSecret(16));
  const superadminToken = getFlag("superadmin-token", randomSecret(12));
  const licenseSecret = getFlag("license-secret", randomSecret(16));

  const envRendered = templateEnv
    .replaceAll("{{DOMAIN_ADMIN}}", adminDomain)
    .replaceAll("{{DOMAIN_STOREFRONT}}", storefrontDomain)
    .replaceAll("{{DOMAIN_API}}", apiDomain)
    .replaceAll("{{ADMIN_EMAIL}}", adminEmail)
    .replaceAll("{{ADMIN_PASSWORD}}", adminPassword)
    .replace(/JWT_SECRET=.*/g, `JWT_SECRET=${jwtSecret}`)
    .concat(
      `\nBRANDING_SECRET=${brandingSecret}\nSUPERADMIN_TOKEN=${superadminToken}\nLICENSE_SECRET=${licenseSecret}\n` +
        `MERCADOPAGO_SUCCESS_URL=https://${storefrontDomain}/checkout/success\n` +
        `MERCADOPAGO_FAILURE_URL=https://${storefrontDomain}/checkout/failure\n` +
        `MERCADOPAGO_PENDING_URL=https://${storefrontDomain}/checkout/pending\n`,
    );

  const composeRendered = templateCompose
    .replace('"3001:3001"', `"${apiPort}:3001"`)
    .replace('"3002:3002"', `"${adminPort}:3002"`)
    .replace('"3003:3003"', `"${storefrontPort}:3003"`)
    .replace('"3004:3004"', `"${botPort}:3004"`)
    .replace('"5432:5432"', `"${dbPort}:5432"`)
    .replace('"6379:6379"', `"${redisPort}:6379"`);

  fs.writeFileSync(path.join(instanceDir, ".env"), envRendered);
  fs.writeFileSync(path.join(instanceDir, "docker-compose.yml"), composeRendered);

  run("docker", ["compose", "-f", path.join(instanceDir, "docker-compose.yml"), "up", "-d"]);

  const healthUrl = `http://localhost:${apiPort}/health`;
  const healthy = await waitForHealth(healthUrl, 40);
  if (!healthy) {
    throw new Error("API health check failed");
  }

  const databaseUrl = `postgresql://erp:erp@localhost:${dbPort}/erp?schema=public`;
  run("pnpm", ["-C", "packages/db", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  if (seed) {
    run("pnpm", ["-C", "packages/db", "prisma", "db", "seed"], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
  }

  const setupUrl = `http://localhost:${apiPort}/setup/initialize`;
  const setupRes = await fetch(setupUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName,
      brandName,
      domain: storefrontDomain,
      adminName,
      adminEmail,
      adminPassword,
    }),
  });
  if (!setupRes.ok && setupRes.status !== 409) {
    const payload = await setupRes.json().catch(() => ({}));
    throw new Error(payload.message ?? "Setup failed");
  }

  if (starterPack || productPackage) {
    const loginRes = await fetch(`http://localhost:${apiPort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    if (!loginRes.ok) {
      throw new Error("Login failed for starter pack");
    }
    const login = await loginRes.json();
    const token = login.accessToken;
    const packRes = await fetch(`http://localhost:${apiPort}/admin/starter-packs/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        catalog: starterPack ? true : false,
        templates: starterPack ? true : false,
        packageId: productPackage || undefined,
      }),
    });
    if (!packRes.ok) {
      const payload = await packRes.json().catch(() => ({}));
      throw new Error(payload.message ?? "Starter pack failed");
    }
  }

  console.log("\nProvisioning complete\n-------------------");
  console.log(`Storefront: https://${storefrontDomain}`);
  console.log(`Admin:      https://${adminDomain}`);
  console.log(`API:        https://${apiDomain}`);
  console.log("");
  console.log("Initial admin:");
  console.log(`  Email: ${adminEmail}`);
  console.log(`  Password: ${adminPassword}`);
  console.log("");
  console.log("DNS steps:");
  console.log(`  A record ${storefrontDomain} -> <server_ip>`);
  console.log(`  A record ${adminDomain} -> <server_ip>`);
  console.log(`  A record ${apiDomain} -> <server_ip>`);
  console.log("");
  console.log("Config dir:");
  console.log(`  ${instanceDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
