# ENTERPRISE_SECURITY_PACK (ES/EN)

## ES

### Objetivo
Generar un **procurement pack** por instancia para procesos de evaluación de seguridad/compliance empresariales.

Incluye:
- IAM (SSO / MFA / SCIM)
- auditoría y evidencias
- backups y DR
- SLOs
- SBOM
- DAST
- accesibilidad
- políticas (controles de compliance + documentos legales publicados)

Se exporta con:
- **ZIP** (payload JSON firmado)
- **PDF resumen** (firmado en manifest)
- registro de evidencia en `ComplianceEvidence`

### UI (Control-plane)
- Ruta: `apps/control-plane/app/security-pack/page.tsx`
- Flujo:
1. cargar instalaciones
2. seleccionar instancia
3. preview JSON
4. descargar PDF resumen
5. descargar ZIP pack

### Endpoints
- `GET /api/security-pack?format=list`
- `GET /api/security-pack?format=json&installationId=...`
- `GET /api/security-pack?format=pdf&installationId=...`
- `GET /api/security-pack?format=zip&installationId=...`

Todos requieren auth admin del control-plane.

### Firma e integridad
- `EnterpriseSecurityPack` incluye:
  - `evidenceManifest.sectionHashes`
  - `evidenceManifest.payloadHash`
- `signEnterpriseSecurityPack()` firma manifest con `HMAC-SHA256`
- hashes opcionales del binario:
  - `zipHash`
  - `pdfHash`

### Persistencia de evidencia
Cada generación ZIP/PDF crea `ComplianceEvidence`:
- `evidenceType = "enterprise_security_pack"`
- tags: `security-pack`, `procurement`, `signed`

### Fuentes usadas (control-plane)
- `Installation`
- `BackupRecord`, `RestoreVerification`, `DisasterRecoveryDrill`
- `SecurityReport` (SBOM/DAST), `DastFinding`
- `AccessibilityReport`
- `ComplianceControl`, `ComplianceEvidence`
- `SodAccessReviewReport`
- `LegalDocument`, `LegalAcceptance`

### Tests
- `apps/control-plane/app/lib/enterprise-security-pack.test.ts`
  - integridad de manifest (firma + tampering)
- `apps/control-plane/app/api/security-pack/security-pack-routes.test.ts`
  - permisos (401 sin auth)

## EN

### Goal
Generate a per-instance **procurement security pack** for enterprise security/compliance review processes.

Includes:
- IAM (SSO / MFA / SCIM)
- audit and evidence
- backups and DR
- SLOs
- SBOM
- DAST
- accessibility
- policies (compliance controls + published legal docs)

Export formats:
- **ZIP** (signed JSON payload)
- **PDF summary** (manifest-signed)
- evidence stored in `ComplianceEvidence`

### UI (Control-plane)
- Route: `apps/control-plane/app/security-pack/page.tsx`
- Flow:
1. load installations
2. select instance
3. preview JSON
4. download summary PDF
5. download ZIP pack

### Endpoints
- `GET /api/security-pack?format=list`
- `GET /api/security-pack?format=json&installationId=...`
- `GET /api/security-pack?format=pdf&installationId=...`
- `GET /api/security-pack?format=zip&installationId=...`

All endpoints require control-plane admin auth.

### Signature and integrity
- `EnterpriseSecurityPack` includes:
  - `evidenceManifest.sectionHashes`
  - `evidenceManifest.payloadHash`
- `signEnterpriseSecurityPack()` signs the manifest with `HMAC-SHA256`
- optional binary hashes:
  - `zipHash`
  - `pdfHash`

### Evidence persistence
Each ZIP/PDF generation creates a `ComplianceEvidence` row:
- `evidenceType = "enterprise_security_pack"`
- tags: `security-pack`, `procurement`, `signed`

### Data sources (control-plane)
- `Installation`
- `BackupRecord`, `RestoreVerification`, `DisasterRecoveryDrill`
- `SecurityReport` (SBOM/DAST), `DastFinding`
- `AccessibilityReport`
- `ComplianceControl`, `ComplianceEvidence`
- `SodAccessReviewReport`
- `LegalDocument`, `LegalAcceptance`

### Tests
- `apps/control-plane/app/lib/enterprise-security-pack.test.ts`
  - manifest integrity (signature + tampering)
- `apps/control-plane/app/api/security-pack/security-pack-routes.test.ts`
  - permissions (401 without auth)

