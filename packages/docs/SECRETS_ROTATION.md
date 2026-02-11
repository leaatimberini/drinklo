# Secrets Rotation & Vault

## Overview
Each company stores integration credentials in an encrypted vault inside the main database. Secrets are encrypted with envelope encryption and can be rotated without restarting services.

## Encryption Model
- Data key: random 32 bytes per secret.
- Master key: `SECRETS_MASTER_KEY` (base64, 32 bytes).
- Secret payload is encrypted with AES-256-GCM using the data key.
- The data key is encrypted with the master key (envelope).

> Do not commit `SECRETS_MASTER_KEY`. Store it in your secret manager or `.env` per environment.

## API Endpoints
Admin (requires `settings:write`):
- `GET /admin/secrets` list secret metadata (no plaintext).
- `POST /admin/secrets/rotate` rotates credentials.
- `POST /admin/secrets/verify` marks a secret as verified.

Rotate payload example:
```
POST /admin/secrets/rotate
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "provider": "MERCADOPAGO",
  "payload": { "accessToken": "..." },
  "expiresAt": "2026-12-31T23:59:59Z",
  "verified": true
}
```

## Supported Providers
Payloads are stored as JSON:
- `MERCADOPAGO`: `{ accessToken, publicKey? }`
- `ANDREANI`: `{ username, password, contract?, client?, category? }`
- `MERCADOLIBRE`: `{ clientId, clientSecret }`
- `ARCA`: `{ certPem, keyPem }` or `{ certPath, keyPath }`

## Audit
Every rotation/verification writes a `SecretAudit` record:
- who (`actorId`)
- when (`createdAt`)
- what (`action`, `changes`)

## Control-Plane Alerts
The instance agent reads `/admin/ops`, includes:
- `secrets.expired`
- `secrets.unverified`

Control-plane raises a warning alert when any count is > 0.

## UI
Admin UI page:
- `apps/admin/app/secrets/page.tsx`
- Allows rotating credentials and marking them verified.

## Operational Notes
- If `SECRETS_MASTER_KEY` changes, secrets must be re-encrypted.
- In staging, use short expirations to validate alerts.
