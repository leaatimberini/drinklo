# Edge Caching & CDN

## ES

## Objetivo
Implementar cache de borde consistente para catálogo/SEO/assets, invalidación por eventos de negocio y telemetría de performance (LCP/TTFB) reportada al control-plane.

## Rutas y headers
- Catálogo API (`/catalog/categories`, `/catalog/products`, `/catalog/products/:id`):
  - `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- Storefront sitemap/robots:
  - `Cache-Control: public, max-age=600, stale-while-revalidate=3600`
- Storefront imágenes (`/images/*`):
  - `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`
- Storefront assets (`/assets/*`, `/_next/static/*`):
  - `Cache-Control: public, max-age=31536000, immutable`

## Purga por evento
Eventos implementados:
- `product_created | product_updated | product_deleted`
- `price_imported` (import de precios)

Flujo:
1. API detecta cambio de producto/precio.
2. Invalida cache local del catálogo (`CatalogService.invalidateAll()`).
3. Publica invalidación al control-plane (`POST /api/edge/invalidate`).

Payload base de invalidación:
```json
{
  "instanceId": "prod-001",
  "companyId": "...",
  "reason": "product_updated",
  "tags": ["catalog", "company:...", "product:..."],
  "paths": ["/", "/products", "/categories", "/products/:id", "/sitemap.xml"]
}
```

## Integración con control-plane
Nuevos endpoints:
- `POST /api/edge/invalidate`
- `POST /api/edge/vitals`

Autenticación ingest:
- Header: `x-cp-ingest-token`
- Env control-plane: `CONTROL_PLANE_INGEST_TOKEN`
- Env API: `CONTROL_PLANE_URL`, `CONTROL_PLANE_INGEST_TOKEN`

Persistencia:
- `EdgeInvalidation`
- `WebVitalSample`

UI control-plane:
- Home: resumen de invalidaciones + promedio LCP/TTFB.
- Detalle instalación: últimos eventos de invalidación y muestras LCP/TTFB.

## Medición de LCP/TTFB
Storefront usa `useReportWebVitals` y envía métricas a:
- `POST {NEXT_PUBLIC_API_URL}/public/edge/vitals`

API retransmite al control-plane con token de ingest.

Variables storefront:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_API_READ_FALLBACK_URLS`
- `NEXT_PUBLIC_SITE_URL`

## Tests
- Header de catálogo:
  - `apps/api/src/modules/catalog/catalog.controller.spec.ts`
- Purga por producto:
  - `apps/api/src/modules/products/products.service.spec.ts`
- Purga por precio/import:
  - `apps/api/src/modules/import-export/import-export.service.spec.ts`

## Operación
- Si control-plane no está configurado o token falta, la app sigue operando (best-effort), sin bloquear writes.
- Recomendado conectar invalidaciones del control-plane al proveedor CDN (Fastly/Cloudflare/etc.) en un worker/job posterior.

---

## EN

## Goal
Provide consistent edge caching for catalog/SEO/assets, event-driven purge, and performance telemetry (LCP/TTFB) reported to control-plane.

## Routes and cache headers
- Catalog API (`/catalog/categories`, `/catalog/products`, `/catalog/products/:id`):
  - `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- Storefront sitemap/robots:
  - `Cache-Control: public, max-age=600, stale-while-revalidate=3600`
- Storefront images (`/images/*`):
  - `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`
- Storefront assets (`/assets/*`, `/_next/static/*`):
  - `Cache-Control: public, max-age=31536000, immutable`

## Event-driven purge
Implemented events:
- `product_created | product_updated | product_deleted`
- `price_imported`

Flow:
1. API detects product/price changes.
2. Catalog in-memory cache is cleared.
3. Invalidation is posted to control-plane (`POST /api/edge/invalidate`).

## Control-plane integration
New endpoints:
- `POST /api/edge/invalidate`
- `POST /api/edge/vitals`

Ingest auth:
- Header `x-cp-ingest-token`
- Env: `CONTROL_PLANE_INGEST_TOKEN`

Storage:
- `EdgeInvalidation`
- `WebVitalSample`

## LCP/TTFB reporting
Storefront reports web vitals using `useReportWebVitals` to:
- `POST {NEXT_PUBLIC_API_URL}/public/edge/vitals`

API forwards to control-plane with ingest token.

## Tests
- Catalog headers: `catalog.controller.spec.ts`
- Product purge trigger: `products.service.spec.ts`
- Price purge trigger: `import-export.service.spec.ts`
