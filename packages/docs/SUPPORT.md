# Support

## Support Portal (Admin)
UI: `apps/admin/app/support/page.tsx`

Features:
- Descargar diagnostic bundle
- Ver health/version y errores/jobs
- Ejecutar smoke en vivo (checks de servicios)

## Endpoints
- `GET /admin/support/summary`
- `GET /admin/support/status`
- `GET /admin/support/latency`
- `POST /admin/support/smoke`

All require role `admin` or `support`.

## Service URLs
Configured via env:
- `SUPPORT_API_URL`
- `SUPPORT_ADMIN_URL`
- `SUPPORT_STOREFRONT_URL`
- `SUPPORT_BOT_URL`

Defaults are localhost ports.

## Diagnostic bundle
Use `GET /admin/ops/diagnostic?limit=50` (admin only).
