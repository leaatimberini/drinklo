# Promotion to Prod

## Command
```
pnpm promote-to-prod
```

## Required env vars
- `STAGING_API_URL`
- `STAGING_ADMIN_TOKEN`
- `PROD_API_URL`
- `PROD_SUPERADMIN_TOKEN`

Optional:
- `PROD_PROVISION_CMD` (command to provision prod stack)
- `PROMOTE_BACKUP_DIR` (default `./backups/promotion`)

## Steps performed
1. Backup staging (`pnpm backup:run`).
2. Export branding/config from staging (`/admin/branding/export`).
3. Provision prod (if `PROD_PROVISION_CMD` is set).
4. Import branding/config (`/admin/branding/import`).
5. Smoke tests: `/health` + `/version` on prod API.
6. Interactive checklist: pagos / envíos / bot / ARCA (ex AFIP).

## Notes
- The import endpoint requires `x-superadmin-token` and only works locally (SuperAdminGuard). Run this script on the prod host or over a secure tunnel.
- This script currently reuses the branding export payload. If you need additional settings, extend the export/import endpoints.

