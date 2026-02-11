import { spawnSync } from "node:child_process";
import process from "node:process";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://erp:erp@localhost:5432/erp?schema=public";
const input = process.env.BACKUP_PATH ?? "./backups/erp.dump";

const result = spawnSync("pg_restore", ["--clean", "--if-exists", "-d", databaseUrl, input], {
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Restore completed from ${input}`);
