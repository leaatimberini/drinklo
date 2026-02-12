# Developer API (ES/EN)

## ES

### Objetivo
Exponer una API publica para integradores con:
- API keys por empresa
- scopes por key
- rate limit por `key + ip`
- auditoria inmutable de uso externo
- webhooks salientes firmados

### Scopes soportados
- `read:products`
- `read:categories`
- `read:pricelists`
- `read:stock`
- `read:orders` (reservado)
- `write:orders` (reservado)

### Endpoints publicos v1 (solo lectura)
Base: `/developer/v1` (header obligatorio `x-api-key`)

- `GET /developer/v1/products?q=&page=&pageSize=`
- `GET /developer/v1/categories`
- `GET /developer/v1/pricelists`
- `GET /developer/v1/stock/availability`

### Gestión admin
Base: `/admin/developer-api` (JWT + permiso `settings:write`)

- `GET /admin/developer-api/scopes`
- `GET /admin/developer-api/keys`
- `POST /admin/developer-api/keys`
- `PATCH /admin/developer-api/keys/:id`
- `POST /admin/developer-api/keys/:id/revoke`
- `GET /admin/developer-api/usage`
- `GET /admin/developer-api/webhooks`
- `POST /admin/developer-api/webhooks`
- `POST /admin/developer-api/webhooks/:id/revoke`

### Rate limiting
- Ventana: 1 minuto
- Bucket: `developerApiKey.id + request.ip`
- Configurable por key (`rateLimitPerMin`)

### Auditoria
Cada request externa persistida en `DeveloperApiUsage` y append-only en `ImmutableAuditLog` con:
- metodo/ruta
- status
- keyId
- ip enmascarada
- flags `scopeDenied` / `rateLimited`

### Webhooks salientes
Eventos:
- `OrderCreated`
- `PaymentApproved`
- `StockLow`

Firma HMAC SHA-256:
- header `x-devwebhook-signature: t=<unix>,v1=<digest>`
- payload firmado: `<timestamp>.<rawBodyJson>`
- headers adicionales: `x-devwebhook-id`, `x-devwebhook-event`, `x-devwebhook-timestamp`

### Variables de entorno
- `DEVELOPER_API_KEY_PEPPER`: pepper para hash de secretos de API keys.
- `DEVELOPER_API_STOCK_LOW_THRESHOLD` (opcional, default `5`).

### OpenAPI
- Swagger UI: `/docs`
- Se agrega esquema `developerApiKey` por header `x-api-key`.
- Contrato versionado: `packages/shared/contracts/openapi/v1.json` (y v2 si aplica).

## EN

### Goal
Provide a public integration API with:
- per-company API keys
- per-key scopes
- rate limiting by `key + ip`
- immutable external usage audit
- signed outgoing webhooks

### Supported scopes
- `read:products`
- `read:categories`
- `read:pricelists`
- `read:stock`
- `read:orders` (reserved)
- `write:orders` (reserved)

### Public v1 endpoints (read-only)
Base path: `/developer/v1` (required `x-api-key` header)

- `GET /developer/v1/products?q=&page=&pageSize=`
- `GET /developer/v1/categories`
- `GET /developer/v1/pricelists`
- `GET /developer/v1/stock/availability`

### Admin management
Base path: `/admin/developer-api` (JWT + `settings:write`)

- `GET /admin/developer-api/scopes`
- `GET /admin/developer-api/keys`
- `POST /admin/developer-api/keys`
- `PATCH /admin/developer-api/keys/:id`
- `POST /admin/developer-api/keys/:id/revoke`
- `GET /admin/developer-api/usage`
- `GET /admin/developer-api/webhooks`
- `POST /admin/developer-api/webhooks`
- `POST /admin/developer-api/webhooks/:id/revoke`

### Rate limiting
- Window: 1 minute
- Bucket key: `developerApiKey.id + request.ip`
- Per-key configurable via `rateLimitPerMin`

### Audit
Each external request is stored in `DeveloperApiUsage` and appended to `ImmutableAuditLog` with:
- method/route
- status
- keyId
- masked ip
- `scopeDenied` / `rateLimited`

### Outgoing webhooks
Events:
- `OrderCreated`
- `PaymentApproved`
- `StockLow`

HMAC SHA-256 signature:
- header `x-devwebhook-signature: t=<unix>,v1=<digest>`
- signed string: `<timestamp>.<rawBodyJson>`
- extra headers: `x-devwebhook-id`, `x-devwebhook-event`, `x-devwebhook-timestamp`

### Environment variables
- `DEVELOPER_API_KEY_PEPPER`: hashing pepper for API key secrets.
- `DEVELOPER_API_STOCK_LOW_THRESHOLD` (optional, default `5`).

### OpenAPI
- Swagger UI: `/docs`
- Includes `developerApiKey` security scheme on `x-api-key`.
- Versioned contract: `packages/shared/contracts/openapi/v1.json` (and v2 when enabled).
