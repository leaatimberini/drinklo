# Compliance AR

Minimal compliance features for Argentina:

## Age Gate
Configurable per company via `CompanySettings.ageGateMode`:
- `DISABLED`
- `18`
- `21`

The storefront shows an age gate if:
- `ageGateMode` is not `DISABLED`, and
- there are alcoholic products in catalog.

Age gate acceptance is stored as a consent record.

## Product classification
Products include:
- `isAlcoholic` (boolean)
- `abv` (alcohol by volume, optional)

These fields are available in admin product CRUD.

## Legal notices
Configurable in company settings:
- `termsUrl`
- `privacyUrl`
- `cookiesUrl`

These are exposed in `GET /compliance/public` and shown in the storefront age gate.

## Marketing consent
If `marketingConsentRequired=true`, the storefront prompts for marketing consent during age gate.
Consent is recorded with timestamp, IP, and optional `userId`.

## API endpoints
Public:
- `GET /compliance/public`
- `POST /compliance/consent`

Admin:
- `GET /admin/compliance`
- `PATCH /admin/compliance`

## Consent audit
Stored in `ConsentRecord` with:
- `companyId`
- `type` (`age_gate`, `marketing`, etc.)
- `accepted`
- `ipAddress`
- `userId`
- `createdAt`
