# Trial Funnel Analytics (ES/EN)

## ES

### Objetivo
Medir trials y conversión del billing del proveedor con foco en campañas:
- funnel por campaña: `signup -> trial -> add payment -> converted`
- cohortes 7/14/30 días
- conversión por ICP (`businessType`, ej. kiosco/distribuidora)
- export CSV y API BI

### Eventos (control-plane)
Se registra `TrialLifecycleEvent` con:
- `TrialStarted`
- `TrialExtended`
- `TrialExpired`
- `PaymentMethodAdded`
- `ConvertedToPaid`
- `BecamePastDue`
- `BecameRestricted`

Fuentes:
- signup trial público (`/api/signup`)
- extensión manual de trial (`/api/trial-campaigns`, acción `extendTrial`)
- pagos (webhook Mercado Pago y mark-paid manual)
- sync derivado (trial expirado, past_due, restricted)

### Modelos
- `TrialLifecycleEvent`
- `LeadAttribution.businessType` (opcional para ICP)

### Endpoints
- `GET /api/trial-analytics` (dashboard JSON)
- `GET /api/trial-analytics/export` (CSV)
- `GET /api/trial-analytics/bi` (JSON para BI)

Query params:
- `from`, `to` (BA `YYYY-MM-DD`)
- `sync=1|0` (si corre sync derivado antes de agregar)

### Dashboard (control-plane)
- `apps/control-plane/app/trial-analytics/page.tsx`
- muestra funnel por campaña, cohortes, ICP, eventos recientes

### Consideraciones
- `PaymentMethodAdded` se infiere al primer pago exitoso Mercado Pago (v1), por falta de un flujo de “add payment method” separado.
- `BecameRestricted` en billing provider se deriva de `hardLimitedAt` o `BillingAccount.status=SUSPENDED`.

## EN

### Goal
Track provider-side trial funnel and conversion:
- campaign funnel
- 7/14/30-day cohorts
- ICP conversion using `businessType` when present
- CSV export + BI API

### Events
`TrialLifecycleEvent` stores:
- `TrialStarted`
- `TrialExtended`
- `TrialExpired`
- `PaymentMethodAdded`
- `ConvertedToPaid`
- `BecamePastDue`
- `BecameRestricted`

### APIs
- `GET /api/trial-analytics`
- `GET /api/trial-analytics/export`
- `GET /api/trial-analytics/bi`

