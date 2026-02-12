# AI Copilot

## ES

## Objetivo
Copiloto IA seguro para operaciones con:
- Consultas NLQ (ventas, stock, clientes, compras, campanas).
- Acciones propuestas con **preview + aprobacion obligatoria**.
- Enforcement RBAC por usuario autenticado.
- Auditoria inmutable en ejecuciones aprobadas.
- Redaccion de PII/secretos en logs del copiloto.

## Arquitectura
- API: `apps/api/src/modules/ai-copilot`
  - `POST /admin/copilot/chat`
  - `GET /admin/copilot/proposals`
  - `POST /admin/copilot/proposals/:id/approve`
- Admin UI: `apps/admin/app/copilot/page.tsx`
- Bot Telegram: comando `/copiloto` (admins allowlist)

## Flujo seguro
1. Usuario envía prompt (admin o telegram).
2. Copiloto responde insight NLQ + genera propuestas `PENDING` (no ejecuta).
3. Usuario aprueba propuesta.
4. Recién ahí se ejecuta acción interna.
5. Se registra auditoria inmutable (`ImmutableAuditLog`) y resultado.

## Modelo de datos
Nuevas tablas (`packages/db/prisma/schema.prisma`):
- `AiCopilotLog`
  - guarda prompt/response redactados + metadata DLP.
- `AiCopilotProposal`
  - estado (`PENDING/APPROVED/EXECUTED/FAILED`), preview, permiso requerido, resultado.

Migracion:
- `packages/db/prisma/migrations/20260212_ai_copilot/migration.sql`

## RBAC y permisos
- Endpoint chat/list/approve requiere JWT + `products:read` base.
- Cada consulta/accion valida permisos finos:
  - ventas: `pricing:read`
  - stock/compras: `inventory:read`
  - clientes: `customers:read`
  - campanas: `settings:write` o rol `marketing`
  - crear cupon: `pricing:write`
  - crear PO / ajustar stock: `inventory:write`

## Acciones soportadas (v1)
- `CREATE_COUPON`
- `CREATE_PURCHASE_ORDER`
- `ADJUST_STOCK`

Siempre pasan por estado `PENDING` hasta aprobación.

## DLP / PII
- Redaccion via `redactDeep()` y `dlpSummary()`.
- Prompt y respuesta se persisten redactados en `AiCopilotLog`.

## Telegram `/copiloto`
- Comando: `/copiloto <prompt>`
- Devuelve respuesta + botones inline para aprobar propuestas.
- Callback ejecuta `POST /admin/copilot/proposals/:id/approve`.

## Tests
- `apps/api/src/modules/ai-copilot/ai-copilot.service.spec.ts`
  - approval obligatoria (chat no ejecuta acción).
  - enforcement de permisos en approve.
  - auditoría inmutable generada al ejecutar.
- `apps/bot/src/index.spec.ts`
  - parse básico `/copiloto`.

---

## EN

## Goal
Secure AI Copilot for operations with:
- NLQ insights (sales, stock, customers, purchasing, campaigns).
- Proposed actions with **mandatory preview + approval**.
- RBAC enforcement from authenticated user context.
- Immutable audit trail for approved executions.
- PII/secret redaction in Copilot logs.

## Architecture
- API: `apps/api/src/modules/ai-copilot`
- Admin UI: `apps/admin/app/copilot/page.tsx`
- Telegram bot: `/copiloto` command for allowed admins.

## Safe execution flow
1. User submits prompt.
2. Copilot returns insights + creates `PENDING` proposals.
3. User explicitly approves.
4. Action is executed.
5. Immutable audit entry is stored.

## Data model
- `AiCopilotLog`: redacted prompt/response + DLP summary.
- `AiCopilotProposal`: status, preview, required permission, execution result.

## RBAC
Fine-grained checks apply per query/action, and approvals enforce required permission before execution.

## Supported actions (v1)
- `CREATE_COUPON`
- `CREATE_PURCHASE_ORDER`
- `ADJUST_STOCK`

## Telegram mode
- `/copiloto <prompt>` creates pending proposals.
- Inline approve button triggers approval endpoint.

## Tests
Core tests cover permission enforcement, mandatory approval, and immutable audit generation.
