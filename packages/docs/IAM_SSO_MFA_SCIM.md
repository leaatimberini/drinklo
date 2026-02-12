# IAM SSO MFA SCIM (ES/EN)

## ES

### Alcance
Se implementó IAM enterprise por compañía con:
- SSO configurable por `OIDC` o `SAML 2.0` (modo mock funcional para pruebas)
- MFA TOTP para admin/soporte con políticas por rol
- SCIM opcional para aprovisionamiento desde IdP (`create` / `disable`)
- UI admin para configuración y test de conexión
- estado IAM por instancia en control-plane

### Modelo de datos
Nuevos modelos en `packages/db/prisma/schema.prisma`:
- `CompanyIamConfig`
- `UserMfaConfig`
- `ScimProvisionLog`

Migración:
- `packages/db/prisma/migrations/20260212_iam_enterprise/migration.sql`

### Endpoints API
- `PATCH /admin/iam/config`: guardar configuración SSO/MFA/SCIM
- `GET /admin/iam/config`: leer estado resumido
- `POST /admin/iam/test-connection`: test OIDC/SAML (validación de campos)
- `POST /admin/iam/mfa/setup`: generar secreto TOTP + `otpauth://`
- `POST /admin/iam/mfa/verify`: validar código y habilitar MFA
- `POST /auth/sso/login`: login SSO mock (`mock:<email>[:name]`)
- `POST /scim/v2/Users`: create user por token SCIM
- `PATCH /scim/v2/Users/:id`: disable user (`active=false`)
- `GET /admin/iam/status`: snapshot IAM para operaciones

### Login + MFA
`/auth/login` ahora acepta `mfaCode` opcional.
Si la política exige MFA y el usuario no envía/valida código:
- responde `mfaRequired: true`
- no emite access token

### UI Admin
Nueva pantalla:
- `apps/admin/app/iam/page.tsx`
Incluye:
- configuración OIDC/SAML
- enforce MFA + roles
- setup/verify MFA
- token SCIM y endpoint
- test connection

### Control-plane
Se agregó estado IAM por instancia desde heartbeats del agent:
- `iamSsoEnabled`
- `iamMfaEnforced`
- `iamScimEnabled`
- `iamLastSyncAt`

Archivos:
- `apps/control-plane/app/api/heartbeats/route.ts`
- `apps/control-plane/app/page.tsx`
- migración `apps/control-plane/prisma/migrations/20260212_iam_status/migration.sql`

### Tests
- `apps/api/src/modules/iam/iam.service.spec.ts`
  - SSO mock login
  - MFA setup/verify
  - SCIM create/disable

## EN

### Scope
Enterprise IAM by company with:
- configurable SSO via `OIDC` or `SAML 2.0` (working mock mode for testing)
- TOTP MFA for admin/support, role-based policies
- optional SCIM provisioning from IdP (`create` / `disable`)
- admin UI for IAM config and connection test
- per-instance IAM status in control-plane

### Data model
New models in `packages/db/prisma/schema.prisma`:
- `CompanyIamConfig`
- `UserMfaConfig`
- `ScimProvisionLog`

Migration:
- `packages/db/prisma/migrations/20260212_iam_enterprise/migration.sql`

### API endpoints
- `PATCH /admin/iam/config`
- `GET /admin/iam/config`
- `POST /admin/iam/test-connection`
- `POST /admin/iam/mfa/setup`
- `POST /admin/iam/mfa/verify`
- `POST /auth/sso/login` (mock: `mock:<email>[:name]`)
- `POST /scim/v2/Users`
- `PATCH /scim/v2/Users/:id`
- `GET /admin/iam/status`

### Login + MFA
`/auth/login` supports optional `mfaCode`.
If MFA is required by policy and code is missing/invalid:
- returns `mfaRequired: true`
- no access token is issued

### Admin UI
New page:
- `apps/admin/app/iam/page.tsx`

### Control-plane
IAM status from instance-agent heartbeat:
- `iamSsoEnabled`
- `iamMfaEnforced`
- `iamScimEnabled`
- `iamLastSyncAt`

### Tests
- `apps/api/src/modules/iam/iam.service.spec.ts`
  - mock SSO login
  - MFA enable/verify
  - SCIM create/disable
