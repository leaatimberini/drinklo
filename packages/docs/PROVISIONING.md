# Provisioning

This script provisions a new instance by copying the deploy template, generating `.env`, starting the stack, running migrations, optionally seeding, and calling setup.

## Command
```
pnpm provision:instance --name acme --domain acme.com --admin-email admin@acme.com --admin-password StrongPass123 --company "Acme SA" --brand "Acme" --seed true
```

If any required value is missing, the script will prompt.

## Flags
- `--name`: instance name (folder under `deploy/instances/`)
- `--domain`: base domain (storefront)
- `--admin-domain`: override admin subdomain (default `admin.<domain>`)
- `--api-domain`: override API subdomain (default `api.<domain>`)
- `--storefront-domain`: override storefront domain (default `<domain>`)
- `--company`: company legal name
- `--brand`: brand name
- `--admin-name`
- `--admin-email`
- `--admin-password`
- `--seed`: `true` or `false`
- `--starter-pack`: `true` to import catalog + templates
- `--product-package`: apply a product package (e.g. `bebidas_base`)
- `--api-port`, `--admin-port`, `--storefront-port`, `--bot-port`, `--db-port`, `--redis-port`

## What it does
1. Copies `deploy/templates` into `deploy/instances/<name>`.
2. Fills `.env` with domain and generated secrets.
3. Starts the stack via `docker compose`.
4. Runs Prisma migrations (and seed if enabled).
5. Calls `/setup/initialize` on the API.
6. Optionally imports starter packs and/or product package.
6. Prints URLs and DNS steps.

## Requirements
- Docker + Docker Compose
- Node 24+
- `pnpm` available

## Notes
- For production, configure TLS/proxy separately (see `DEPLOY_PROD.md`).
- The script assumes images `erp-*` are already built/pulled.
