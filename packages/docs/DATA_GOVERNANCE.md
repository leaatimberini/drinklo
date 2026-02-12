# Data Governance (ES/EN)

## ES

### Objetivo
Agregar gobierno de datos operativo con:
- retencion por entidad y por plan,
- legal hold por cliente/periodo,
- DLP basico para redaccion de secretos y tarjetas,
- job de purge con trazabilidad.

### Planes y retencion default
Fuente de plan: `LicenseKey.plan`.
Fallback: `pro`.

- `starter`: orders 180, logs 30, events 60, marketing 90
- `pro`: orders 365, logs 90, events 180, marketing 365
- `enterprise`: orders 730, logs 365, events 365, marketing 730

Entidades:
- `ORDERS`
- `LOGS`
- `EVENTS`
- `MARKETING`

### Modelo de datos
- `DataRetentionPolicy`
- `LegalHold`
- `GovernanceRun`
- Enums: `GovernanceEntity`, `LegalHoldStatus`

### Legal Hold
- Alta con `customerId` + `periodFrom/periodTo` opcionales.
- `ACTIVE` bloquea purge para datos que matchean cliente/periodo.
- `RELEASED` deja de bloquear.

### DLP basico
Redaccion automatica (`redact + continue`) para:
- secretos/tokens/passwords
- Bearer/JWT
- PAN de tarjeta valido por Luhn

Placeholders:
- `[REDACTED_SECRET]`
- `[REDACTED_JWT]`
- `[REDACTED_CARD]`

Aplicado en:
- persistencia de `WebhookLog` payload/headers
- errores de observabilidad (`OpsService`/exception filter)

### Purge job
Cron diario BA: `15 3 * * *` (controlado por `GOVERNANCE_CRON_ENABLED`).

Accion por entidad:
- `ORDERS`: anonimiza PII (no borra orden)
- `EVENTS`: delete fuera de retencion y sin hold
- `MARKETING`: delete `AutomationSendLog` + `EmailEventLog`
- `LOGS`: delete `WebhookLog` + `BotCommandLog` + `PrivacyRequest`

Se registra `GovernanceRun.summary` con:
- `scanned`, `purged`, `anonymized`, `skippedByHold`, `unresolvedIdentity`, `errors`

### API (admin)
- `GET /admin/governance/policies/effective`
- `GET /admin/governance/policies`
- `PUT /admin/governance/policies`
- `POST /admin/governance/legal-holds`
- `GET /admin/governance/legal-holds`
- `POST /admin/governance/legal-holds/:id/release`
- `POST /admin/governance/purge/run`
- `GET /admin/governance/purge/runs`

### Compatibilidad
- `PrivacyModule` sigue exponiendo `/admin/privacy/policies`.
- Internamente delega a `DataGovernance` (plan `pro`) para no romper UI legacy.

### Variables de entorno
- `GOVERNANCE_CRON_ENABLED=true|false`
- `GOVERNANCE_CRON_SCHEDULE` (reservado, default actual fijo)
- `GOVERNANCE_DLP_ENABLED=true|false` (reservado)

## EN

### Goal
Provide practical data governance with:
- plan/entity retention,
- customer/time-range legal hold,
- basic DLP redaction,
- traceable purge job.

### Default retention matrix
Plan source: `LicenseKey.plan`.
Fallback: `pro`.

- `starter`: orders 180, logs 30, events 60, marketing 90
- `pro`: orders 365, logs 90, events 180, marketing 365
- `enterprise`: orders 730, logs 365, events 365, marketing 730

Entities:
- `ORDERS`
- `LOGS`
- `EVENTS`
- `MARKETING`

### Data model
- `DataRetentionPolicy`
- `LegalHold`
- `GovernanceRun`
- Enums: `GovernanceEntity`, `LegalHoldStatus`

### Legal hold
- Create with `customerId` and optional `periodFrom/periodTo`.
- `ACTIVE` blocks purge for matching customer/time-range.
- `RELEASED` no longer blocks.

### Basic DLP
Redaction mode (`redact + continue`) for:
- secrets/tokens/passwords
- Bearer/JWT
- card PAN (Luhn valid)

Applied to:
- `WebhookLog` payload/headers persistence
- observability error persistence (`OpsService`/exception filter)

### Purge job
Daily BA cron: `15 3 * * *` (`GOVERNANCE_CRON_ENABLED`).

Per-entity behavior:
- `ORDERS`: anonymize PII (keep order for reporting)
- `EVENTS`: hard delete outside retention and not held
- `MARKETING`: hard delete `AutomationSendLog` + `EmailEventLog`
- `LOGS`: hard delete `WebhookLog` + `BotCommandLog` + `PrivacyRequest`

Run summary stored in `GovernanceRun.summary` with:
- `scanned`, `purged`, `anonymized`, `skippedByHold`, `unresolvedIdentity`, `errors`

### Admin API
- `GET /admin/governance/policies/effective`
- `GET /admin/governance/policies`
- `PUT /admin/governance/policies`
- `POST /admin/governance/legal-holds`
- `GET /admin/governance/legal-holds`
- `POST /admin/governance/legal-holds/:id/release`
- `POST /admin/governance/purge/run`
- `GET /admin/governance/purge/runs`
