# Licensing

Licensing is per Company and controls premium features without breaking core sales flows.

## License payload
A license key is a signed payload:
- `companyId`
- `plan`
- `expiresAt` (ISO date)
- `features` (string array)
- `issuedAt` (ISO date)

Signed using HMAC-SHA256 with `LICENSE_SECRET`:
```
base64url(payload) + "." + signature
```

## Env vars
- `LICENSE_SECRET`: required to generate/apply/validate locally
- `LICENSE_SERVER_URL`: optional phone-home validator (`POST /validate`)

## API endpoints
- `GET /admin/license` (admin): status and validity
- `POST /admin/license/apply` (superadmin): apply a license key
- `POST /admin/license/generate` (superadmin): generate + store a license key

## Premium features (gated)
- `afip` (ARCA ex AFIP)
- `andreani`
- `mercadolibre`
- `rappi`
- `pedidosya`
- `email_ai`

If a feature is not in the license or the license is expired, the API blocks that module. Core sales remain available.

## UI
Admin has a simple license status view at `apps/admin/app/license/page.tsx`.

## Tests
- Expiration
- Feature gating / downgrade behavior

See `apps/api/src/modules/licensing/licensing.service.spec.ts`.
