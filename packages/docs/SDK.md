# SDK (ES/EN)

## ES

### Objetivo
`packages/sdk` provee el cliente oficial TypeScript para integrar con la Developer API.

Incluye:
- auth por API key (`x-api-key`)
- tipos generados desde OpenAPI (`packages/shared/contracts/openapi/v1.json`)
- helpers de paginacion, retries e idempotencia
- tests unitarios y contract con mock server
- examples de referencia
- Postman collection y environments

### Estructura
- `packages/sdk/src/client.ts`: cliente `ErpSdkClient`
- `packages/sdk/src/helpers.ts`: `paginate`, `createIdempotencyKey`, utilidades
- `packages/sdk/src/generated/openapi-types.ts`: tipos generados
- `packages/sdk/scripts/generate-types.mjs`: generador OpenAPI -> TS
- `packages/sdk/test/*`: unit + contract

### Endpoints cubiertos
- `GET /developer/v1/products`
- `GET /developer/v1/categories`
- `GET /developer/v1/pricelists`
- `GET /developer/v1/stock/availability`
- `POST /checkout/orders` (helper `createOrder`, hasta exponer `/developer/v1/orders`)

### Uso rapido
```ts
import { ErpSdkClient } from "@erp/sdk";

const sdk = new ErpSdkClient({
  baseUrl: "https://api.example.com",
  apiKey: process.env.ERP_API_KEY!,
});

const products = await sdk.listProducts({ page: 1, pageSize: 20 });
```

### Helpers
- Retries automaticos en `429` y `5xx`.
- `createIdempotencyKey(prefix?)` para headers `Idempotency-Key`.
- `paginateProducts()` y helper generico `paginate()`.

### Scripts
- `pnpm -C packages/sdk generate:types`
- `pnpm -C packages/sdk build`
- `pnpm -C packages/sdk test`

### Examples
- `examples/example-node-sync-products`
- `examples/example-create-order`
- `examples/example-webhook-receiver`

### Postman
- `packages/sdk/postman/ERP_Developer_API.postman_collection.json`
- `packages/sdk/postman/local.postman_environment.json`
- `packages/sdk/postman/staging.postman_environment.json`
- `packages/sdk/postman/production.postman_environment.json`

## EN

### Goal
`packages/sdk` provides the official TypeScript client for Developer API integrations.

It includes:
- API key auth (`x-api-key`)
- OpenAPI-generated types (`packages/shared/contracts/openapi/v1.json`)
- pagination, retry and idempotency helpers
- unit and contract tests with a mock server
- reference examples
- Postman collection and environment templates

### Structure
- `packages/sdk/src/client.ts`: `ErpSdkClient`
- `packages/sdk/src/helpers.ts`: `paginate`, `createIdempotencyKey`, helpers
- `packages/sdk/src/generated/openapi-types.ts`: generated types
- `packages/sdk/scripts/generate-types.mjs`: OpenAPI -> TS generator
- `packages/sdk/test/*`: unit + contract

### Covered endpoints
- `GET /developer/v1/products`
- `GET /developer/v1/categories`
- `GET /developer/v1/pricelists`
- `GET /developer/v1/stock/availability`
- `POST /checkout/orders` (`createOrder` helper until `/developer/v1/orders` is exposed)

### Quick start
```ts
import { ErpSdkClient } from "@erp/sdk";

const sdk = new ErpSdkClient({
  baseUrl: "https://api.example.com",
  apiKey: process.env.ERP_API_KEY!,
});

const products = await sdk.listProducts({ page: 1, pageSize: 20 });
```

### Helpers
- Automatic retries on `429` and `5xx`.
- `createIdempotencyKey(prefix?)` for `Idempotency-Key` headers.
- `paginateProducts()` and generic `paginate()` helper.

### Scripts
- `pnpm -C packages/sdk generate:types`
- `pnpm -C packages/sdk build`
- `pnpm -C packages/sdk test`

### Examples
- `examples/example-node-sync-products`
- `examples/example-create-order`
- `examples/example-webhook-receiver`

### Postman
- `packages/sdk/postman/ERP_Developer_API.postman_collection.json`
- `packages/sdk/postman/local.postman_environment.json`
- `packages/sdk/postman/staging.postman_environment.json`
- `packages/sdk/postman/production.postman_environment.json`
