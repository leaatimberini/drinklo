# ARCA Readiness Add-on (ES)

## Objetivo
Asistente para preparar activacion de **ARCA (ex AFIP)** desde Admin con:
- checklist tecnico/fiscal
- validaciones automaticas (CUIT, certificados, expiracion, entorno, punto de venta)
- dry run en homologacion (WSAA + WSFEv1)
- reporte PDF firmado (HMAC)

## UI (Admin)
Ruta sugerida: `/arca-readiness`

Incluye:
- tipos de comprobante a evaluar (`A/B/C/M`)
- monto de prueba y override de punto de venta
- acciones:
  - `Validar checklist`
  - `Dry run HOMO`
  - `Generar reporte PDF firmado`

## API (instance)
Endpoints protegidos (`JWT + settings:write`):
- `GET /billing/arca/readiness`
- `POST /billing/arca/readiness/dry-run`
- `POST /billing/arca/readiness/report`

## Checklist validado
### Fiscal
- modo fiscal ARCA (`billingMode=AFIP`, `enableAfip=true`)
- CUIT (estructura + checksum)
- punto de venta (>0)
- tipos de comprobante seleccionados

### Tecnico
- entorno configurado (`HOMO/PROD`) + entorno efectivo (respeta `AFIP_SANDBOX`)
- certificado X.509 + clave privada (parse de formato)
- expiracion de certificado (warning si < 15 dias)
- emisor de certificado (`afipCertIssuer`) recomendado

## Dry Run (Homologacion)
- fuerza ambiente `HOMO`
- obtiene token WSAA (stub/mock si corresponde)
- ejecuta casos WSFEv1 por tipo de comprobante seleccionado
- registra resultados en `AfipLog` (`ARCA_READINESS_DRYRUN`)
- audita en `ImmutableAuditLog`

## Reporte PDF firmado
- genera PDF con checklist + resumen dry-run
- calcula `payloadHash` (SHA-256)
- firma HMAC (`ARCA_READINESS_REPORT_SECRET` o fallback)
- guarda PDF en storage y devuelve `signedUrl`
- audita en `ImmutableAuditLog`

## Tests
- checklist (fallas / warnings)
- dry-run con mocks (WSFE parcial OK/FAIL)
- generacion de reporte firmado

---

# ARCA Readiness Add-on (EN)

## Purpose
Assistant to prepare **ARCA (ex AFIP)** activation from Admin with:
- technical/fiscal checklist
- automatic validations (CUIT, certificates, expiration, environment, POS)
- homologation dry run (WSAA + WSFEv1)
- signed PDF report (HMAC)

## UI (Admin)
Suggested route: `/arca-readiness`

Includes:
- invoice types to evaluate (`A/B/C/M`)
- test amount and optional point-of-sale override
- actions:
  - `Validate checklist`
  - `HOMO dry run`
  - `Generate signed PDF report`

## API (instance)
Protected endpoints (`JWT + settings:write`):
- `GET /billing/arca/readiness`
- `POST /billing/arca/readiness/dry-run`
- `POST /billing/arca/readiness/report`

## Validated checklist
### Fiscal
- ARCA fiscal mode (`billingMode=AFIP`, `enableAfip=true`)
- CUIT (format + checksum)
- point of sale (>0)
- selected invoice types

### Technical
- configured environment (`HOMO/PROD`) + effective environment (`AFIP_SANDBOX` aware)
- X.509 certificate + private key (format parsing)
- certificate expiration (warning if < 15 days)
- certificate issuer (`afipCertIssuer`) recommended

## Dry Run (Homologation)
- forces `HOMO`
- gets WSAA token (stub/mock where applicable)
- runs WSFEv1 test cases for selected invoice types
- stores results in `AfipLog` (`ARCA_READINESS_DRYRUN`)
- appends immutable audit entry

## Signed PDF report
- builds PDF with checklist + dry-run summary
- computes `payloadHash` (SHA-256)
- signs via HMAC (`ARCA_READINESS_REPORT_SECRET` fallback chain)
- stores PDF in storage and returns `signedUrl`
- appends immutable audit entry

## Tests
- checklist (fail/warn scenarios)
- dry-run flow with mocked WSFE responses
- signed report generation
