# Performance

## Objectives
API p95 latency targets (staging):
- Catalog endpoints: `< 500ms`
- Checkout quote: `< 800ms`
- Admin list endpoints: `< 800ms`

Storefront targets (staging):
- TTFB: `< 600ms`
- LCP: `< 2500ms`

## Caching
- API catalog responses include `Cache-Control: public, max-age=60, stale-while-revalidate=300`.
- Storefront uses ISR (`revalidate: 30`) on home and category pages.

## Load tests
Scripts:
- `pnpm perf:api` (autocannon)
- `pnpm perf:storefront` (Playwright for TTFB/LCP)
- `pnpm perf` (runs both)

Env vars:
- `PERF_BASE_URL` (API base URL)
- `PERF_ADMIN_TOKEN` (JWT for admin endpoints)
- `PERF_STOREFRONT_URL` (storefront base URL)
- `PERF_P95_CATALOG_MS` (default 500)
- `PERF_P95_CHECKOUT_MS` (default 800)
- `PERF_P95_ADMIN_MS` (default 800)
- `PERF_TTFB_MS` (default 600)
- `PERF_LCP_MS` (default 2500)
- `PERF_DURATION` (seconds, default 10)
- `PERF_CONNECTIONS` (default 20)

## CI
CI job `performance` runs when `PERF_BASE_URL` secret is present. It fails the build if thresholds are exceeded, which acts as the alert mechanism for regressions.

## Notes
- Admin perf check is skipped if `PERF_ADMIN_TOKEN` is not set.
- For deeper storefront analysis, run Lighthouse on staging.
