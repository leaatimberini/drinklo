# SoD & Access Reviews

## ES

## Objetivo
Implementar controles enterprise de **Segregación de Funciones (SoD)** y campañas de **Access Reviews**:
- políticas SoD configurables
- enforcement en endpoints sensibles (RBAC + guard)
- alertas/eventos de violación SoD
- campañas mensuales/trimestrales de revisión de accesos
- dashboard en control-plane por instancia

## Conceptos

### SoD (Segregation of Duties)
Políticas que impiden (o alertan) cuando un usuario puede ejecutar acciones incompatibles.

Acciones soportadas inicialmente:
- `PRICING_CONFIGURE`
- `PURCHASE_APPROVE`
- `INVOICE_ISSUE`
- `RECONCILIATION_RUN`

Políticas default:
1. Configurar precios vs aprobar compras (`DENY`)
2. Facturar vs conciliar (`DENY`)

### Access Reviews
Campañas para revisar accesos/roles/permisos de usuarios:
- `MONTHLY`
- `QUARTERLY`

Workflow:
1. Crear campaña (snapshot de usuarios/roles/permisos)
2. Revisar ítems (`APPROVE`, `REVOKE`, `CHANGES_REQUIRED`)
3. Aprobar campaña
4. Completar campaña

## Modelo de datos (instancia/API)
- `SodPolicy`
- `SodViolationEvent`
- `AccessReviewCampaign`
- `AccessReviewItem`

## Enforcement en RBAC
El `PermissionsGuard` ahora:
1. valida permisos requeridos del endpoint
2. lee metadata `@SodAction(...)`
3. consulta políticas SoD activas de la compañía
4. registra `SodViolationEvent`
5. bloquea (`DENY`) o permite con alerta (`ALERT`)

Endpoints anotados:
- `taxes` (writes) -> `PRICING_CONFIGURE`
- `purchasing/orders/:id/approve` -> `PURCHASE_APPROVE`
- `admin/reconciliation/*` -> `RECONCILIATION_RUN`
- `billing/invoices` -> `INVOICE_ISSUE`

## Endpoints API (admin)
- `GET /admin/sod/policies`
- `PUT /admin/sod/policies`
- `GET /admin/sod/violations`
- `GET /admin/sod/summary`
- `POST /admin/sod/report-control-plane`

Access Reviews:
- `GET /admin/sod/access-reviews/campaigns`
- `POST /admin/sod/access-reviews/campaigns`
- `GET /admin/sod/access-reviews/campaigns/:id/items`
- `POST /admin/sod/access-reviews/items/:id/review`
- `POST /admin/sod/access-reviews/campaigns/:id/approve`
- `POST /admin/sod/access-reviews/campaigns/:id/complete`

## Control-plane

### Ingest
- `POST /api/sod/report` (auth con `x-cp-ingest-token`)

Payload resumido:
```json
{
  "instanceId": "inst-001",
  "companyId": "co_123",
  "capturedAt": "2026-02-25T12:00:00.000Z",
  "metrics": {
    "activePolicies": 2,
    "totalPolicies": 2,
    "violations24h": 1,
    "openCampaigns": 1,
    "overdueCampaigns": 0
  }
}
```

### Dashboard
- `apps/control-plane/app/sod-access-reviews/page.tsx`

Muestra por instancia:
- políticas activas/total
- violaciones SoD últimas 24h
- campañas abiertas / vencidas
- alertas SoD últimos 7 días

## Tests
- `apps/api/src/modules/common/rbac.guard.spec.ts`
  - bloqueo por SoD desde guard
- `apps/api/src/modules/sod-access-reviews/sod-access-reviews.service.spec.ts`
  - enforcement + generación de campañas

## Consideraciones
- La detección de conflicto se basa en permisos efectivos del JWT + mapeo de acciones SoD.
- Si querés mayor granularidad, crear permisos específicos (ej. `purchasing:approve`, `reconciliation:run`) y mapear acciones SoD a esos scopes.
- Reporte a control-plane es best-effort (no bloquea request).

---

## EN

## Goal
Enterprise-grade **Segregation of Duties (SoD)** and **Access Review** workflows:
- configurable SoD policies
- RBAC enforcement on sensitive endpoints
- SoD violation alerts/events
- monthly/quarterly access review campaigns
- control-plane dashboard per instance

## Concepts

### SoD
Policies that prevent (or alert on) incompatible action combinations for the same user.

Initial supported actions:
- `PRICING_CONFIGURE`
- `PURCHASE_APPROVE`
- `INVOICE_ISSUE`
- `RECONCILIATION_RUN`

Default policies:
1. Pricing config vs purchase approval (`DENY`)
2. Invoice issuance vs reconciliation (`DENY`)

### Access Reviews
Campaigns to review user roles/permissions:
- `MONTHLY`
- `QUARTERLY`

Workflow:
1. Create campaign (user/role/permission snapshot)
2. Review items (`APPROVE`, `REVOKE`, `CHANGES_REQUIRED`)
3. Approve campaign
4. Complete campaign

## Instance/API data model
- `SodPolicy`
- `SodViolationEvent`
- `AccessReviewCampaign`
- `AccessReviewItem`

## RBAC enforcement
`PermissionsGuard` now:
1. validates endpoint permissions
2. reads `@SodAction(...)`
3. checks active SoD policies for the company
4. records `SodViolationEvent`
5. blocks (`DENY`) or allows with alert (`ALERT`)

## Admin API endpoints
- `GET /admin/sod/policies`
- `PUT /admin/sod/policies`
- `GET /admin/sod/violations`
- `GET /admin/sod/summary`
- `POST /admin/sod/report-control-plane`

Access Reviews:
- `GET /admin/sod/access-reviews/campaigns`
- `POST /admin/sod/access-reviews/campaigns`
- `GET /admin/sod/access-reviews/campaigns/:id/items`
- `POST /admin/sod/access-reviews/items/:id/review`
- `POST /admin/sod/access-reviews/campaigns/:id/approve`
- `POST /admin/sod/access-reviews/campaigns/:id/complete`

## Control-plane
- Ingest: `POST /api/sod/report` (`x-cp-ingest-token`)
- Dashboard: `apps/control-plane/app/sod-access-reviews/page.tsx`

## Tests
- Guard enforcement: `rbac.guard.spec.ts`
- Campaign generation: `sod-access-reviews.service.spec.ts`
