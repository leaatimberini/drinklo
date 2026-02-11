# Quotes (Presupuestos)

## API
- `GET /quotes`
- `POST /quotes`
- `GET /quotes/:id`
- `PUT /quotes/:id`
- `DELETE /quotes/:id`
- `POST /quotes/:id/convert` (to Sale)
- `GET /quotes/:id/pdf` (download PDF)

## PDF Generation
- Uses Playwright `page.pdf()` with an HTML template.
- Service: `apps/api/src/modules/shared/pdf.service.ts`.

## Bot Command
- `/presupuesto <cliente> <productId:qty,productId:qty>`
- Requires allowlist `BOT_ALLOWLIST` and admin credentials (`BOT_ADMIN_EMAIL`, `BOT_ADMIN_PASSWORD`).
- Returns PDF from `/quotes/:id/pdf`.

## Security
- Bot allowlist by `chat_id`.
- Admin role enforced via credentials check.
