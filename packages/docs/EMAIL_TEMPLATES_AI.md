# Email Templates (AI)

## Model
- `EmailTemplate`: type, subject, body (HTML/MJML), version, status (`DRAFT`/`APPROVED`).
- `CompanySettings.brandTone`: used to steer tone.

## Generation Flow
1. Admin generates a template (`/admin/email-templates/generate`).
2. LLM adapter (mock by default) receives:
   - theme tokens (colors, typography)
   - logo URL
   - brand tone
   - objective
3. Template is saved as `DRAFT` and returned.

## Approval Flow
- Admin edits/updates and approves with `/admin/email-templates/:id/approve`.

## Sending
- Provider is configurable via `EMAIL_PROVIDER`.
  - `mock` (default): logs to console.
  - `smtp`: uses SMTP settings (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`).
- Use `/admin/email-templates/:id/send-test` to send a test email.

## Files
- `apps/api/src/modules/email-templates/*`
- `apps/admin/app/email-templates/page.tsx`
- `packages/db/prisma/schema.prisma`

## Env
```
EMAIL_PROVIDER=mock
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```
