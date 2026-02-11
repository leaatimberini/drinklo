import { execSync } from "node:child_process";
import process from "node:process";

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://erp:erp@localhost:5432/erp?schema=public",
};

try {
  execSync("pnpm -C packages/db prisma migrate diff --from-migrations --to-schema-datamodel --exit-code", {
    stdio: "inherit",
    env,
  });
} catch (error) {
  console.error("Schema mismatch detected. Run migrations.");
  process.exit(1);
}
