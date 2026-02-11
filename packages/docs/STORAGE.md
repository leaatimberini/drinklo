# Storage

This repo uses an abstracted `StorageAdapter` (S3 compatible) with MinIO for staging/local and S3-compatible storage for production.

## Adapter
Interface methods:
- `put(key, body, contentType?, cacheControl?)`
- `get(key)`
- `delete(key)`
- `signedUrl(key, expiresInSeconds?)`

Current implementation: `S3StorageAdapter` using AWS SDK.

## Environment variables (API)
- `STORAGE_BUCKET` (default: `erp`)
- `STORAGE_REGION` (default: `us-east-1`)
- `STORAGE_ENDPOINT` (MinIO endpoint in staging/local)
- `STORAGE_ACCESS_KEY`
- `STORAGE_SECRET_KEY`
- `STORAGE_FORCE_PATH_STYLE` (`true` for MinIO)
- `STORAGE_PUBLIC_URL` (base URL for public assets)
- `STORAGE_SIGNED_URL_TTL_SECONDS` (default: 900)
- `STORAGE_PUBLIC_FALLBACK_TTL_SECONDS` (default: 604800)
- `STORAGE_RETENTION_DAYS` (default: 30)

## MinIO (local/staging)
`docker-compose.yml` includes MinIO:
- API: `http://localhost:9000`
- Console: `http://localhost:9001`
- Default creds: `minioadmin` / `minioadmin`

Use these envs in `apps/api/.env.example` or `.env.staging.example`:
- `STORAGE_ENDPOINT=http://localhost:9000`
- `STORAGE_FORCE_PATH_STYLE=true`
- `STORAGE_PUBLIC_URL=http://localhost:9000`

## Uploads migrated to storage
- Branding assets: logo and favicon are stored in object storage via `/admin/branding/logo` and `/admin/branding/favicon`.
- Product images: `/products/:id/image` uploads an image and stores a public URL in `Product.imageUrl`.
- PDFs (quotes/orders/invoices): generated on demand, stored under `pdfs/`, and served via signed URLs.

## Signed URLs for PDFs
`GET /quotes/:id/pdf`, `GET /checkout/orders/:id/pdf`, `GET /billing/invoices/:id/pdf` respond with a redirect to a signed URL.

## Retention cleanup
A scheduled job runs daily at 03:00 and deletes `pdfs/` objects older than `STORAGE_RETENTION_DAYS`.

## Adapter tests
MinIO-backed tests live in `apps/api/src/modules/storage/storage.adapter.spec.ts`.
To run them:
1. Start MinIO via `docker compose up -d minio`.
2. Set `MINIO_TESTS=true`.
3. Run `pnpm --filter @erp/api test`.
