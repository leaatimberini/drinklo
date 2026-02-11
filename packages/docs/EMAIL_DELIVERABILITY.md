# Email Deliverability

## Overview
The Domain & Email module tracks DNS configuration and deliverability events.

## Wizard (Admin)
Admin UI allows configuring:
- Provider type (`SMTP` or `API`)
- Provider name
- Domain
- DNS records for SPF, DKIM, DMARC
- Manual verification checklist and confirmation

## DNS guidance
Typical records:
- SPF: `v=spf1 include:provider.example ~all`
- DKIM: selector and TXT value from provider
- DMARC: `v=DMARC1; p=none; rua=mailto:postmaster@domain`

## Endpoints
Admin:
- `GET /admin/email-domain`
- `PATCH /admin/email-domain`
- `POST /admin/email-domain/confirm`

Webhook:
- `POST /webhooks/email` with `{ type, recipient, messageId, provider }`

## Deliverability tracking
- Events are stored in `EmailEventLog`.
- Use `type` values: `bounce`, `complaint`, `delivered`, `opened` (if supported).

## Manual verification
Admin can confirm after DNS is published and a test email is delivered.

## Tests
- DTO validation (provider type)
- Service persistence (upsert/confirm/log)
