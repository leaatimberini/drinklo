# Immutable Audit (ES/EN)

## ES

### Objetivo
Agregar auditoría inmutable (tamper-evident) para acciones críticas con hash chaining, export de evidencia firmado y soporte opcional de retención tipo WORM.

### Alcance implementado
- Event sourcing parcial para dominios críticos:
  - `configuration`
  - `pricing`
  - `stock`
  - `billing`
- Log append-only: modelo `ImmutableAuditLog`.
- Cadena hash por registro:
  - `previousHash`
  - `payloadHash`
  - `chainHash`
- Verificación de integridad:
  - mismatch de `previousHash`
  - mismatch de `payloadHash`
  - mismatch de `chainHash`
- Evidence pack firmado (HMAC-SHA256).

### Modelo de datos
- `packages/db/prisma/schema.prisma`
  - `ImmutableAuditLog`
- migración:
  - `packages/db/prisma/migrations/20260212_immutable_audit/migration.sql`

### API (admin)
- `GET /admin/audit`
  - búsqueda avanzada por categoría, acción, ruta, actor, aggregate, rango fecha, límite.
- `GET /admin/audit/verify`
  - valida cadena hash y reporta primer punto de alteración.
- `GET /admin/audit/evidence-pack`
  - export JSON firmado para auditorías externas.

### Ingesta automática (event sourcing parcial)
- interceptor global: `ImmutableAuditInterceptor`
- clasifica rutas críticas y agrega eventos al ledger inmutable.

### UI
- Admin: `apps/admin/app/audit/page.tsx`
  - búsqueda avanzada
  - verify chain
  - export evidence pack
- Control-plane: `apps/control-plane/app/audit/page.tsx`
  - explorer central para instancias
  - verify + export remoto

### Storage WORM / retención
- opción `STORAGE_WORM_MODE=true`
- al activar, `StorageService.delete()` queda bloqueado con error de retención.

### Seguridad de evidencia
- firma HMAC con:
  - `AUDIT_EVIDENCE_SECRET`
  - fallback `JWT_SECRET`

### Tests
- `apps/api/src/modules/immutable-audit/immutable-audit.service.spec.ts`
  - hash chain válido
  - detección de alteración
  - export firmado

---

## EN

### Goal
Implement tamper-evident immutable auditing for critical actions with hash chaining, signed evidence export, and optional WORM-style retention mode.

### Implemented scope
- Partial event sourcing for critical domains:
  - `configuration`
  - `pricing`
  - `stock`
  - `billing`
- Append-only log model: `ImmutableAuditLog`.
- Per-entry hash chain:
  - `previousHash`
  - `payloadHash`
  - `chainHash`
- Integrity verification with explicit failure reason.
- Signed evidence pack export (HMAC-SHA256).

### Data model
- `packages/db/prisma/schema.prisma` (`ImmutableAuditLog`)
- migration:
  - `packages/db/prisma/migrations/20260212_immutable_audit/migration.sql`

### API
- `GET /admin/audit`
- `GET /admin/audit/verify`
- `GET /admin/audit/evidence-pack`

### Automatic ingestion
- global interceptor: `ImmutableAuditInterceptor`
- critical routes are classified and appended to the immutable ledger.

### UI
- Admin: `apps/admin/app/audit/page.tsx`
- Control-plane: `apps/control-plane/app/audit/page.tsx`

### Optional WORM retention
- env: `STORAGE_WORM_MODE=true`
- `StorageService.delete()` is blocked when enabled.

### Evidence signing
- `AUDIT_EVIDENCE_SECRET` (fallback `JWT_SECRET`).

### Tests
- `apps/api/src/modules/immutable-audit/immutable-audit.service.spec.ts`
  - valid hash chain
  - tampering detection
  - signed evidence export
