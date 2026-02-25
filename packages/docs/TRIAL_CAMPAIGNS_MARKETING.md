# Trial Campaigns Marketing (ES/EN)

## ES

### Objetivo
Motor de campañas de trial del proveedor para captación:
- códigos de campaña (`/signup?trial=CODE`)
- control por tier (`C1/C2`)
- anti-abuso básico
- métricas de conversión y churn temprano
- extensión manual de trial con auditoría

### Modelo de datos (control-plane)
- `TrialCampaign`
  - `code`, `tier`, `durationDays`, `maxRedemptions`, `expiresAt`
  - `requiresApproval`, `allowedDomains`, `blockedDomains`
  - `status`, `notes`
- `TrialRedemption`
  - `campaignId`, `companyId`, `instanceId`, `billingAccountId`
  - `emailDomain`, `ipHash`, `fingerprintHash`
  - `status`, `reason`, `redeemedAt`
- `LeadAttribution`
  - `utmSource`, `utmCampaign`, `referral`, `landing`
  - hashes (`ipHash`, `fingerprintHash`)

### Anti-abuso (v1)
- 1 trial por `emailDomain`
- 1 trial por `fingerprintHash`
- rate limit por IP (intentos/hora)
- dominios bloqueados globales por env + bloqueos por campaña
- modo de rechazo: se registra `TrialRedemption` con `status` y `reason`

### Endpoints
- Público:
  - `GET /api/signup?trial=CODE` (preview campaña)
  - `POST /api/signup` (redeem/signup)
- Interno marketing/admin:
  - `GET /api/trial-campaigns`
  - `POST /api/trial-campaigns` (`create`, `revoke`, `extendTrial`)
  - `PATCH /api/trial-campaigns/:id`

### Variables de entorno (opcionales)
- `TRIAL_CAMPAIGN_BLOCKED_DOMAINS=foo.com,bar.com`
- `TRIAL_CAMPAIGN_BLOCKED_FINGERPRINTS=<hash1>,<hash2>`
- `TRIAL_CAMPAIGN_SIGNUP_MAX_ATTEMPTS_PER_HOUR=5`
- `TRIAL_CAMPAIGN_HASH_SALT=<secret>`

### UI
- `apps/control-plane/app/trial-campaigns/page.tsx`
  - crear/editar/revocar campañas
  - ver métricas (redemptions, trials activos, conversiones a pago, churn temprano)
  - extensión manual de trial (auditada en `ComplianceEvidence`)
- `apps/control-plane/app/signup/page.tsx`
  - formulario público básico para redeem de trial

### Auditoría
- Extensión manual de trial crea evidencia `trial_extension` en `ComplianceEvidence` con hash de payload.

## EN

### Goal
Provider-side trial campaign engine for acquisition:
- trial codes (`/signup?trial=CODE`)
- tier-targeted campaigns (`C1/C2`)
- basic abuse prevention
- conversion / early churn metrics
- manual trial extension with audit evidence

### Data model (control-plane)
- `TrialCampaign`
- `TrialRedemption`
- `LeadAttribution`

### Anti-abuse (v1)
- one trial per email domain
- one trial per fingerprint
- IP rate limiting (attempts per hour)
- global blocked domains via env + per-campaign blocked domains
- rejected attempts are persisted with status/reason

### API
- Public:
  - `GET /api/signup?trial=CODE`
  - `POST /api/signup`
- Internal marketing/admin:
  - `GET /api/trial-campaigns`
  - `POST /api/trial-campaigns` (`create`, `revoke`, `extendTrial`)
  - `PATCH /api/trial-campaigns/:id`

### Notes
- `requiresApproval=true` stores redemption as `PENDING_APPROVAL` (manual approval workflow can be added in v2).
- Trial extension updates `BillingAccount.trialEndsAt` and stores audit evidence in `ComplianceEvidence`.

