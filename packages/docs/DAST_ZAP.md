# DAST ZAP (ES/EN)

## ES

### Objetivo
Implementar DAST continuo en staging con OWASP ZAP baseline para:
- storefront
- admin
- api

Incluye:
- pipeline CI con reportes SARIF + HTML,
- ingest de hallazgos en control-plane,
- seguimiento por severidad/estado/SLA,
- UI para triage.

### Workflow CI
Archivo:
- `.github/workflows/dast.yml`

Escaneo:
- `zap-baseline.py` contra 3 targets (`DAST_STAGING_STOREFRONT_URL`, `DAST_STAGING_ADMIN_URL`, `DAST_STAGING_API_URL`)

Artifacts:
- `zap-api.html/json/md`
- `zap-admin.html/json/md`
- `zap-storefront.html/json/md`
- `zap-results.sarif`

Publicacion SARIF:
- `github/codeql-action/upload-sarif@v3`

### Parseo e ingest
Scripts:
- `scripts/zap-report-utils.mjs` (parseo ZAP + SARIF builder)
- `scripts/zap-json-to-sarif.mjs`
- `scripts/ingest-dast-findings.mjs`

Endpoint ingest (control-plane):
- `POST /api/security-report/dast`

Payload esperado:
- `instanceId`, `repo`, `sha`, `runId`, `status`
- `findings[]` con `target`, `ruleId`, `title`, `severity`, `route`, `evidence`, `recommendation`

### Modelo de hallazgos
`DastFinding` en control-plane:
- severidad: `critical/high/medium/low/info`
- estado: `open/triaged/fixed`
- ruta + evidencia + recomendacion
- SLA interno por severidad (`slaDueAt`)

SLA default:
- critical: 7 dias
- high: 14 dias
- medium: 30 dias
- low: 90 dias
- info: 180 dias

### UI de hallazgos
Pantalla:
- `/security-dast`

Funcionalidades:
- lista de hallazgos con filtros por estado/severidad
- resumen de conteos
- cambio de estado (`open/triaged/fixed`)

API admin:
- `GET /api/security-report/dast-findings`
- `PATCH /api/security-report/dast-findings/:id`

### Tests
- `scripts/zap-report-utils.test.mjs`
  - parseo ZAP -> findings
  - conversion a SARIF
- `apps/control-plane/app/lib/dast-findings.spec.ts`
  - SLA por severidad
  - resumen para UI lista de hallazgos

## EN

### Goal
Add continuous DAST in staging using OWASP ZAP baseline for:
- storefront
- admin
- api

Includes:
- CI pipeline with SARIF + HTML outputs,
- finding ingestion into control-plane,
- tracking by severity/status/SLA,
- triage UI.

### CI workflow
File:
- `.github/workflows/dast.yml`

Scan:
- `zap-baseline.py` against 3 targets (`DAST_STAGING_STOREFRONT_URL`, `DAST_STAGING_ADMIN_URL`, `DAST_STAGING_API_URL`)

Artifacts:
- `zap-api.html/json/md`
- `zap-admin.html/json/md`
- `zap-storefront.html/json/md`
- `zap-results.sarif`

SARIF upload:
- `github/codeql-action/upload-sarif@v3`

### Parsing and ingestion
Scripts:
- `scripts/zap-report-utils.mjs` (ZAP parser + SARIF builder)
- `scripts/zap-json-to-sarif.mjs`
- `scripts/ingest-dast-findings.mjs`

Ingest endpoint (control-plane):
- `POST /api/security-report/dast`

Expected payload:
- `instanceId`, `repo`, `sha`, `runId`, `status`
- `findings[]` with `target`, `ruleId`, `title`, `severity`, `route`, `evidence`, `recommendation`

### Findings model
`DastFinding` in control-plane:
- severity: `critical/high/medium/low/info`
- state: `open/triaged/fixed`
- route + evidence + recommendation
- internal SLA per severity (`slaDueAt`)

Default SLA:
- critical: 7 days
- high: 14 days
- medium: 30 days
- low: 90 days
- info: 180 days

### Findings UI
Page:
- `/security-dast`

Features:
- findings list with status/severity filters
- count summary
- status update (`open/triaged/fixed`)

Admin API:
- `GET /api/security-report/dast-findings`
- `PATCH /api/security-report/dast-findings/:id`

### Tests
- `scripts/zap-report-utils.test.mjs`
  - parse ZAP report to findings
  - convert findings to SARIF
- `apps/control-plane/app/lib/dast-findings.spec.ts`
  - SLA by severity
  - summary used by findings list UI
