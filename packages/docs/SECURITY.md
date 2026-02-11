# Security

## Headers & CORS
- Helmet enabled for common security headers.
- CORS strict allowlist from `CORS_ORIGINS`.

## Rate Limiting
- Throttling enabled for all routes.
- Key includes IP and token (if present).

## CSRF
- For `/admin` non-GET routes, requires `x-csrf-token` header matching `csrf_token` cookie.

## Webhooks
- Signature verification + idempotency required.
- Mercado Pago webhooks validated and stored in `WebhookLog` with `(provider, eventId)` unique.

## Input Sanitization
- Sanitization pipe blocks common XSS patterns and trims strings.
- DTO validation via `class-validator`.

## RBAC
- Roles/permissions enforced by guards.
- Tests verify access denied when role/permission missing.

## OWASP Checklist (basic)
- [ ] Enforce TLS in prod
- [ ] Secure headers (Helmet)
- [ ] CORS allowlist
- [ ] Rate limiting
- [ ] CSRF for admin
- [ ] Input validation + sanitization
- [ ] Authn/Authz (RBAC)
- [ ] Logging + monitoring
- [ ] Secrets outside repo
- [ ] Dependency scanning

## Files
- `apps/api/src/main.ts`
- `apps/api/src/security/*`
- `apps/api/src/modules/common/*`
- `apps/api/src/modules/payments/mercadopago.webhook.controller.ts`
- `apps/api/.env.example`
