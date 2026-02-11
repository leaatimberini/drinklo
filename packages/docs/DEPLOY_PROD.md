# Deploy Production (VPS)

This blueprint uses Docker Compose + Caddy as reverse proxy with TLS.

## 1) Prerequisites
- VPS with ports 80/443 open.
- Docker + Docker Compose installed.
- DNS records pointing your domain to the VPS IP.

## 2) Prepare env
Copy and customize:
- `deploy/prod/.env`

Example (minimum):
```
DOMAIN=your-domain.com
NODE_ENV=production
DATABASE_URL=postgresql://erp:erp@postgres:5432/erp?schema=public
REDIS_URL=redis://redis:6379
JWT_SECRET=replace_me
CORS_ORIGINS=https://your-domain.com,https://your-domain.com/admin
NEXT_PUBLIC_API_URL=https://your-domain.com/api
API_URL=https://your-domain.com/api
STORAGE_BUCKET=erp
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY=replace_me
STORAGE_SECRET_KEY=replace_me
STORAGE_FORCE_PATH_STYLE=false
STORAGE_PUBLIC_URL=
```

## 3) Configure Caddy
Caddyfile is already set at `deploy/prod/Caddyfile`.
- TLS is automatic via Let's Encrypt.
- Includes HSTS, CSP, gzip/brotli, and 20MB body limit.

Routes:
- `/` -> `storefront`
- `/admin` -> `admin`
- `/api` -> `api`
- `/bot` -> `bot` webhook endpoint

## 4) Start deployment
From repo root:
```
pnpm deploy:up
```

## 5) Upgrade deployment
```
pnpm deploy:upgrade
```

## 6) Logs / stop
```
pnpm deploy:logs
pnpm deploy:down
```

## Notes
- Update images in `deploy/prod/docker-compose.yml` to match your registry.
- Ensure `CORS_ORIGINS` includes admin + storefront URLs.
- For S3-compatible storage, set `STORAGE_ENDPOINT` if not AWS and set `STORAGE_FORCE_PATH_STYLE=true`.
- Bot webhook should point to `https://your-domain.com/bot/webhook` (or the configured bot route).
