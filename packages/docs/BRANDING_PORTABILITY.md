# Branding Portability

## Export
- Endpoint: `POST /admin/branding/export`
- Requires admin JWT
- Returns `{ payload, signature }`
- Signature: HMAC SHA256 over stable JSON with `BRANDING_SECRET`

## Import
- Endpoint: `POST /admin/branding/import`
- Requires local superadmin token (`x-superadmin-token`) and localhost
- Body: `{ payload, signature, apply }`
  - `apply=false` returns preview
  - `apply=true` persists settings

## Payload Fields
- `brandName`, `domain`
- `logoUrl`, `faviconUrl`
- `seoTitle`, `seoDescription`, `seoKeywords`
- `templateId`
- `storefrontTheme`, `adminTheme`

## Storage
- URLs are stored as strings; upload/storage is external.
- Ensure assets are accessible before import.

## Env
- `BRANDING_SECRET`
- `SUPERADMIN_TOKEN`

## Files
- `apps/api/src/modules/branding/*`
- `apps/admin/app/branding/page.tsx`
