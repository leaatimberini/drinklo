# Partner Certification / Certificación de Partners

## ES

### Objetivo
Agregar un flujo de certificación para partners técnicos:
- **Certification Test Kit** con pruebas contractuales (OpenAPI + eventos), sandbox harness y checklist de seguridad/performance.
- **Portal partner** para cargar resultados firmados.
- **Control-plane** para emitir certificaciones con expiración.

### Componentes
- Kit (generado por API):
  - `GET /api/partners/portal/certification-kit`
- Carga de resultados firmados:
  - `POST /api/partners/portal/certification-runs`
- Historial partner:
  - `GET /api/partners/portal/certification-runs`
- Emisión admin:
  - `GET /api/partners/admin/certifications`
  - `POST /api/partners/admin/certifications`

### Firma de reportes
- Algoritmo: `HMAC-SHA256`
- Secret: **portal token** del partner
- Payload firmado: JSON estable del reporte

### Reporte esperado (resumen)
- `kitVersion`
- `openapi`: `passed`, `testsRun`, `failures`
- `events`: `passed`, `schemasChecked`, `incompatibleSchemas`
- `sandbox`: `passed`, `scenariosRun`, `failedScenarios`
- `security.checklist[]`
- `performance`: `p95ApiMs`, `p95WebhookProcessingMs`, `checklist[]`

### Reglas de validación v1
- OpenAPI y eventos: mínimos de cobertura + `passed=true`
- Sandbox: mínimo de escenarios + `passed=true`
- Seguridad: checklist completo obligatorio
- Performance:
  - `p95ApiMs <= 500`
  - `p95WebhookProcessingMs <= 1000`
  - checklist completo obligatorio

### Certificación
- Se emite desde control-plane solo sobre runs `PASSED`.
- Incluye:
  - `certificateNo`
  - `issuedAt`
  - `expiresAt`
  - `evidenceHash` (hash del reporte validado)
- Estado computado:
  - `ACTIVE`, `EXPIRED`, `REVOKED`

### UI
- Partner portal: `/partner-portal` (sección Certification Test Kit y upload firmado)
- Control-plane admin: `/partner-certifications`

## EN

### Goal
Add a certification workflow for technical partners:
- **Certification Test Kit** with contractual tests (OpenAPI + events), sandbox harness, and security/performance checklist.
- **Partner portal** to upload signed results.
- **Control-plane** to issue certifications with expiration.

### Components
- Kit API:
  - `GET /api/partners/portal/certification-kit`
- Signed result upload:
  - `POST /api/partners/portal/certification-runs`
- Partner history:
  - `GET /api/partners/portal/certification-runs`
- Admin issuance:
  - `GET /api/partners/admin/certifications`
  - `POST /api/partners/admin/certifications`

### Report signing
- Algorithm: `HMAC-SHA256`
- Secret: partner **portal token**
- Signed payload: stable JSON serialization of the report

### Validation rules (v1)
- Contract checks (OpenAPI/events) must meet minimums and pass
- Sandbox harness must meet scenario minimum and pass
- Security checklist is mandatory
- Performance thresholds:
  - `p95ApiMs <= 500`
  - `p95WebhookProcessingMs <= 1000`
  - performance checklist mandatory

### Certification issuance
- Issued in control-plane only from `PASSED` runs.
- Stores evidence hash from validated report.
- Computed status: `ACTIVE`, `EXPIRED`, `REVOKED`

