# Customer Support Portal (B2B)

## Overview
Customer portal for B2B clients (non-store admins):
- Login
- Open tickets
- Attach diagnostic bundle
- View incidents
- View integration status

App:
- `apps/customer-portal` (Next.js)

API:
- `apps/api/src/modules/support-portal/*`

## Auth
Portal login uses its own JWT secret:
- `SUPPORT_PORTAL_JWT_SECRET`

Login:
```
POST /portal/auth/login
{ "email": "...", "password": "...", "companyId": "optional" }
```

## Tickets
Endpoints (portal JWT):
- `GET /portal/tickets`
- `POST /portal/tickets`
- `GET /portal/tickets/detail?id=...`
- `POST /portal/tickets/message?id=...`
- `POST /portal/tickets/diagnostic?id=...` (stores ops bundle in storage)

Attachments are stored in storage under:
`support/diagnostics/<companyId>/<ticketId>/...`

## Incidents
Endpoint:
- `GET /portal/incidents`

## Integrations
Endpoint:
- `GET /portal/integrations` (uses latest health logs)

## Inbound Email (Optional)
Enable inbound email integration:
- `SUPPORT_EMAIL_INBOUND_ENABLED=true`
- `SUPPORT_EMAIL_INBOUND_TOKEN=...`

Webhook:
```
POST /portal/email/inbound
Headers: x-support-email-token
Body: { companyId, from, subject, text }
```

## SLAs (Config Only)
Company settings fields:
- `supportPlan`
- `supportSlaFirstResponseHours`
- `supportSlaResolutionHours`

No automatic promises are enforced; used for display/ops only.

## Admin Provisioning
Create portal users from admin:
```
POST /admin/support/customers
{ "email": "...", "name": "...", "password": "..." }
```

## Setup
1. Set `SUPPORT_PORTAL_JWT_SECRET`.
2. Create support customers via admin.
3. Start portal: `pnpm --filter @erp/customer-portal dev`.
