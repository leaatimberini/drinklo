# Installer

## Overview
Creates a deployable setup using Docker Compose and initializes the ERP instance.

## Files
- `deploy/templates/docker-compose.yml`
- `deploy/templates/.env.template`
- `scripts/installer.mjs`

## Run (Windows)
```
pnpm installer
```

## Run (Server/Linux)
```
pnpm installer
```

## What it does
1. Prompts for: domain, company name, admin email, admin password.
2. Generates `deploy/.env` from template.
3. Writes `deploy/docker-compose.yml`.
4. Runs `docker compose up -d`.
5. Calls `POST /setup/initialize`.
6. Writes marker file `deploy/.installed` to prevent re-run.

## Notes
- `.installed` prevents re-running the installer.
- If you need to re-run, remove `deploy/.installed`.
- Replace `BOT_TOKEN` manually if you use the bot.
