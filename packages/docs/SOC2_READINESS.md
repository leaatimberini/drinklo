# SOC2 Readiness (ES/EN)

## ES

### Alcance
Este modulo prepara evidencia para auditorias SOC2, **sin prometer certificacion**.

Objetivo:
- recolectar evidencias tecnicas de forma automatica,
- mapear evidencias a controles base (security/availability/confidentiality),
- exportar un paquete firmado para auditor externo.

### Modulo Compliance Evidence (control-plane)
UI:
- `/compliance-evidence`

API:
- `GET /api/compliance/controls`
- `GET /api/compliance/evidence?limit=200`
- `POST /api/compliance/evidence/collect`
- `GET /api/compliance/audit-package` (zip firmado)

Permisos:
- solo admin control-plane (`x-cp-admin-token` o sesion admin)

### Evidencias recolectadas automaticamente
- releases (`ReleaseManifest`)
- SBOM (`SecurityReport.kind=sbom`)
- backups (`BackupRecord`)
- DR drills (`DisasterRecoveryDrill`)
- access logs (proxy operativo por `PluginJob`)
- MFA enforced (`Installation.iamMfaEnforced`)
- SLOs (`Installation.slo*`)

### Integridad
Cada evidencia se guarda en `ComplianceEvidence` con:
- `payload` JSON
- `payloadHash` (SHA-256 canonical)
- `sourceCapturedAt`, `capturedAt`
- `tags`, `capturedBy`

### Mapeo de controles (plantilla)
Modelo `ComplianceControl` con controles seed:
- `CC6.1_ACCESS_MFA` (Security)
- `CC7.2_RELEASE_INTEGRITY` (Security)
- `A1.2_BACKUP_DR` (Availability)
- `A1.3_SERVICE_SLOS` (Availability)
- `C1.1_CONFIDENTIALITY_LOGS` (Confidentiality)

### Audit Package firmado
Export:
- `GET /api/compliance/audit-package`

Contenido:
- `audit-package.json` dentro de zip
- controles + evidencias + disclaimer
- firma HMAC SHA-256

Header HTTP:
- `x-audit-signature`

Nota:
- La firma valida integridad del paquete exportado, no certifica cumplimiento.

### Modelos DB
- `ComplianceControl`
- `ComplianceEvidence`

Migracion:
- `apps/control-plane/prisma/migrations/20260212_soc2_readiness/migration.sql`

### Tests
- `apps/control-plane/app/lib/compliance-evidence.spec.ts`
  - hash determinista
  - export zip (cabecera PK)
  - permisos admin header

## EN

### Scope
This module supports SOC2 audit readiness, **without claiming certification**.

Goal:
- automatically collect technical evidence,
- map evidence to baseline controls (security/availability/confidentiality),
- export a signed package for external auditors.

### Compliance Evidence module (control-plane)
UI:
- `/compliance-evidence`

API:
- `GET /api/compliance/controls`
- `GET /api/compliance/evidence?limit=200`
- `POST /api/compliance/evidence/collect`
- `GET /api/compliance/audit-package` (signed zip)

Permissions:
- admin only in control-plane (`x-cp-admin-token` or admin session)

### Automatically collected evidence
- releases (`ReleaseManifest`)
- SBOM (`SecurityReport.kind=sbom`)
- backups (`BackupRecord`)
- DR drills (`DisasterRecoveryDrill`)
- access logs (operational proxy via `PluginJob`)
- MFA enforced (`Installation.iamMfaEnforced`)
- SLOs (`Installation.slo*`)

### Integrity
Each evidence item in `ComplianceEvidence` stores:
- JSON `payload`
- `payloadHash` (canonical SHA-256)
- `sourceCapturedAt`, `capturedAt`
- `tags`, `capturedBy`

### Control mapping template
`ComplianceControl` seeds:
- `CC6.1_ACCESS_MFA` (Security)
- `CC7.2_RELEASE_INTEGRITY` (Security)
- `A1.2_BACKUP_DR` (Availability)
- `A1.3_SERVICE_SLOS` (Availability)
- `C1.1_CONFIDENTIALITY_LOGS` (Confidentiality)

### Signed audit package
Export:
- `GET /api/compliance/audit-package`

Content:
- `audit-package.json` inside zip
- controls + evidence + disclaimer
- HMAC SHA-256 signature

HTTP header:
- `x-audit-signature`

Note:
- Signature ensures package integrity; it does not represent SOC2 certification.

### DB models
- `ComplianceControl`
- `ComplianceEvidence`

Migration:
- `apps/control-plane/prisma/migrations/20260212_soc2_readiness/migration.sql`

### Tests
- `apps/control-plane/app/lib/compliance-evidence.spec.ts`
  - deterministic hash
  - zip export magic header
  - admin header permission
