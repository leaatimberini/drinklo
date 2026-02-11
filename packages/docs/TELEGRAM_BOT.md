# Telegram Bot

## Commands
- `/stock <query>`: search stock by SKU/barcode/name.
- `/precio <query>`: price lookup.
- `/cliente_nuevo <nombre>`: create customer (requires confirmation).
- `/presupuesto_pdf <cliente> <productId:qty,productId:qty>`: creates quote and returns PDF.
- `/lista_precios`: sample catalog list.
- `/pedido_estado <orderId>`: order status events.

## Security
- Allowlist by `BOT_ALLOWLIST` (chat_id).
- Admin credentials validated by bot config.
- Inline confirmation for mutations.
- Rate limit per chat (20/min).

## Audit
- Each command is logged to `BotCommandLog` via `POST /admin/bot-audit` (admin JWT).

## Files
- `apps/bot/src/index.ts`
- `apps/bot/src/index.spec.ts`
- `packages/db/prisma/schema.prisma`
