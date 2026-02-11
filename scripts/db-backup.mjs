import { spawnSync } from "node:child_process";
import process from "node:process";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://erp:erp@localhost:5432/erp?schema=public";
const output = process.env.BACKUP_PATH ?? "./backups/erp.dump";

const result = spawnSync("pg_dump", ["-Fc", databaseUrl, "-f", output], {
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Backup saved to ${output}`);
