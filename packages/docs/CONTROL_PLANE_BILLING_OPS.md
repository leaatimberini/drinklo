# Control Plane Billing Ops (ES/EN)

## ES

### Objetivo
Operaciones masivas de billing desde `apps/control-plane` con auditoría firmada y workflow de aprobación:

- cambio de tier (`C1/C2/C3`) en múltiples instancias
- extensión de trial por campaña o lista de `instance_id`
- pausa/cancelación por fraude

### Endpoints

- `GET /api/billing/bulk-ops`
  - lista acciones recientes, campañas de trial activas y catálogo de planes
- `POST /api/billing/bulk-ops`
  - crea acción masiva (`action=create`)
- `POST /api/billing/bulk-ops/:id`
  - `approve` / `reject` / `execute`

### Safety y Auditoría

- Confirmación UI obligatoria (`confirmed=true`).
- Manifest hash (`SHA-256`) + firma HMAC para:
  - request
  - approval/reject
  - execution/failure
- Evidencias append-only en `ComplianceEvidence`.
- `BulkBillingAction` y `BulkBillingActionApproval` guardan hash/firma y trazabilidad de aprobadores.
- 2-person approval opcional:
  - por flag en request (`requireTwoPersonApproval`)
  - por env/threshold
  - exige distinto rol y actor para la segunda aprobación

### Variables de entorno (opcionales)

- `CONTROL_PLANE_BULK_OPS_REQUIRE_TWO_PERSON=true|false`
- `CONTROL_PLANE_BULK_OPS_TWO_PERSON_THRESHOLD=25`
- `CONTROL_PLANE_BULK_OPS_SIGNING_SECRET=...`

### Comportamiento por acción

- `SET_TIER`
  - actualiza `BillingAccount.planId`
  - registra `BillingPlanChange` (sin prorrateo; operación de soporte)
- `EXTEND_TRIAL`
  - extiende `trialEndsAt` desde `max(now, trialEndsAt)`
  - soporta targets por `campaignId` y/o `instanceIds`
- `FRAUD_PAUSE`
  - `BillingAccount.status -> SUSPENDED`
- `FRAUD_CANCEL`
  - `BillingAccount.status -> CANCELED`

En acciones de fraude/extensión se generan `Alert`s por instalación.

### UI

- Control-plane: `\/billing\/bulk-ops`
  - crear acción
  - aprobar/rechazar/ejecutar
  - inspeccionar manifest, payload, resultado y aprobaciones

### Tests

- permisos de roles (support/ops/admin)
- reglas de 2-person approval
- hash/firma deterministas y tamper-evident del manifest

---

## EN

### Goal
Bulk billing operations in `apps/control-plane` with signed audit evidence and approval workflow:

- set tier (`C1/C2/C3`) for multiple instances
- grant trial extensions by campaign or explicit `instance_id` list
- fraud pause/cancel actions

### Endpoints

- `GET /api/billing/bulk-ops`
- `POST /api/billing/bulk-ops` (`action=create`)
- `POST /api/billing/bulk-ops/:id` (`approve` / `reject` / `execute`)

### Safety and Audit

- UI confirmation required (`confirmed=true`)
- SHA-256 manifest hash + HMAC signature for request/approval/execution
- append-only evidence rows in `ComplianceEvidence`
- optional two-person approval (request flag and/or env threshold)
- second approval must come from a different role and actor

### Optional env vars

- `CONTROL_PLANE_BULK_OPS_REQUIRE_TWO_PERSON`
- `CONTROL_PLANE_BULK_OPS_TWO_PERSON_THRESHOLD`
- `CONTROL_PLANE_BULK_OPS_SIGNING_SECRET`

### Action behavior

- `SET_TIER`: updates `BillingAccount.planId`, records `BillingPlanChange`
- `EXTEND_TRIAL`: extends `trialEndsAt` from `max(now, current trial end)`
- `FRAUD_PAUSE`: sets account status to `SUSPENDED`
- `FRAUD_CANCEL`: sets account status to `CANCELED`

### UI

- Control-plane page: `\/billing\/bulk-ops`

### Tests

- role permissions
- two-person approval enforcement
- deterministic signed manifest / tamper detection

