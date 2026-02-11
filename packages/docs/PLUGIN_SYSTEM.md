# Plugin System

## Overview
Plugins extend the system without forks. They define:
- Hooks (events)
- UI slots
- Permissions

Plugins live in `packages/plugins/*` and are loaded by the API at runtime.

## Extension Points
API hooks:
- `product.decorate` (augment product response)
- `pricing.unitPrice` (adjust unit price per line)

UI slots:
- `admin.dashboard`
- `storefront.home`

## Plugin Manifest
`packages/plugins/<name>/manifest.json`:
```
{
  "name": "product-label",
  "version": "0.1.0",
  "permissions": ["products:read"],
  "hooks": ["product.decorate"],
  "uiSlots": ["admin.dashboard"],
  "signature": "<hex-hmac>"
}
```

## Signing & Allowlist
Signing uses HMAC-SHA256 with `PLUGIN_SIGNING_SECRET`.

Sign a plugin:
```
PLUGIN_SIGNING_SECRET=... pnpm plugin:sign product-label
```

Allowlist:
- Instance env `PLUGIN_ALLOWLIST` (comma-separated).
- Company-level enablement via `CompanyPlugin` (admin API).
- Control-plane approval is required for installation requests (see `PLUGIN_MARKETPLACE.md`).

Unsigned plugins are only allowed when:
- `PLUGIN_ALLOW_UNSIGNED=true`, or
- `NODE_ENV` != `production`.

## RBAC / Scopes
Plugins declare `permissions`. The company allowlist can further restrict to a subset.
At runtime, a plugin only receives its allowed scopes in the hook context. If a hook requires a scope (e.g. `pricing:write`) and it's not allowed, it is skipped.

## Admin API
List and configure plugins:
```
GET /admin/plugins
POST /admin/plugins
{ "name": "product-label", "enabled": true, "allowedPermissions": ["products:read"] }
```

UI slots:
```
GET /plugins/ui?slot=admin.dashboard
```

## Examples
### Product label
Adds `label: "Nuevo"` to products created in the last 7 days.

### Promo rule
Applies 10% discount for items with quantity >= 6.

## Tests
- `apps/api/src/modules/plugins/plugins.service.spec.ts`
  - Pricing hook applies only when permission allowed.
