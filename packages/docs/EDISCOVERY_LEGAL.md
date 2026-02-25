# eDiscovery & Legal Holds

## ES

## Objetivo
Extender eDiscovery para soporte legal/forense:
- export forense de pedidos, facturas, auditoría inmutable, eventos, cambios de configuración y accesos
- legal hold extendido por cliente o usuario, con rango temporal y alcance por entidad
- evidencia del hold con hash
- export firmado con manifest hash verificable
- verificación desde API y UI admin

## Legal Hold extendido

### Modelo (`LegalHold`)
Campos nuevos:
- `userId?`
- `userEmailSnapshot?`
- `entityScopes: GovernanceEntity[]`
- `evidence: Json?`
- `evidenceHash: string?`

Compatibilidad:
- `customerId` pasa a opcional (antes obligatorio)
- sigue soportando holds por cliente existentes

### Creación (API)
Endpoint existente:
- `POST /admin/governance/legal-holds`

Ahora acepta:
- `customerId?`
- `userId?`
- `periodFrom?`, `periodTo?`
- `entities?` (`ORDERS|LOGS|EVENTS|MARKETING`)
- `reason`
- `evidence?`

Reglas:
- requiere `customerId` o `userId`
- si no se envían `entities`, aplica a todas las entidades gobernadas
- se persiste `evidenceHash = sha256(stableStringify(evidence))`

### Purga / retención
La purga programada respeta holds:
- por cliente/email (ya existente)
- por `userId` (nuevo) en entidades donde exista identidad (`EVENTS`, `LOGS`)
- por `entityScopes` (nuevo)

## Export forense (eDiscovery)

### Endpoint
- `POST /admin/ediscovery/export`

Body opcional:
```json
{
  "entities": ["orders", "invoices", "audit", "events", "config_changes", "accesses", "legal_holds"],
  "from": "2026-01-01T00:00:00.000Z",
  "to": "2026-01-31T23:59:59.999Z"
}
```

### Entidades soportadas
- `orders`
  - orders + items + payments + status events + `OrderTaxBreakdown`
- `invoices`
  - invoices + ARCA/AFIP logs (`AfipLog`)
- `audit`
  - `ImmutableAuditLog` + verificación de hash chain
- `events`
  - `EventLog`
- `config_changes`
  - auditoría inmutable categoría `configuration`
  - snapshots actuales: `CompanySettings`, retención, SoD
  - `SecretAudit`
- `accesses`
  - users, roles, permissions, role-permissions, user-branches, access reviews
- `legal_holds`
  - holds + evidencia + manifest de evidencia (`evidenceHash`)

## Manifest firmado y verificable

Formato (resumen):
- `manifest.sections[]`: `{ name, count, hash }`
- `manifest.payloadHash`: hash del listado de secciones
- `signature`: HMAC-SHA256 del pack canónico (sin `signature`)

La firma reutiliza el secreto del módulo de auditoría inmutable (`AUDIT_EVIDENCE_SECRET` o fallback).

## Verificación

### API
- `POST /admin/ediscovery/verify`

Body:
```json
{ "pack": { "...": "..." } }
```

Valida:
1. versión soportada
2. hashes por sección (`manifest`)
3. firma HMAC del contenido canónico

### UI Admin
- `apps/admin/app/ediscovery/page.tsx`

Permite:
- generar export
- pegar/cargar JSON
- verificar integridad/firma

## Tests
- `apps/api/src/modules/ediscovery/ediscovery.service.spec.ts`
  - export firmado + verificación OK
  - detección de tampering
- `apps/api/src/modules/data-governance/data-governance.service.spec.ts`
  - hold por usuario + entidad bloquea purga de eventos

## Límites / Notas
- Export forense actual es JSON (no ZIP) para simplicidad.
- Se aplican límites de `take` por sección para evitar payloads extremos; el pack informa `truncated` cuando corresponde.
- “Accesos” exporta asignaciones y campañas de review, no logs de login detallados (si se incorporan más adelante, se agregan como sección adicional).

---

## EN

## Goal
Extend eDiscovery with legal/forensic capabilities:
- forensic export of orders, invoices, immutable audit, events, config changes and access assignments
- extended legal hold by customer or user, with time range and entity scope
- hold evidence + evidence hash
- signed export with verifiable hash manifest
- verification via API and admin UI

## Extended Legal Hold
- `LegalHold` now supports `userId`, `entityScopes`, `evidence`, `evidenceHash`
- `customerId` is now optional (backward compatible for existing customer-based holds)
- purge/retention honors user-scoped and entity-scoped holds where identity is resolvable

## Forensic Export (eDiscovery)
- `POST /admin/ediscovery/export`
- supported sections:
  - `orders`
  - `invoices`
  - `audit`
  - `events`
  - `config_changes`
  - `accesses`
  - `legal_holds`

## Signed / Verifiable Manifest
- per-section hashes in `manifest.sections`
- aggregate `manifest.payloadHash`
- HMAC-SHA256 signature over canonical JSON payload

## Verification
- `POST /admin/ediscovery/verify`
- Admin UI: `apps/admin/app/ediscovery/page.tsx`

## Tests
- eDiscovery export integrity / tamper detection
- user/entity legal hold prevents purge

