# Plugin Publishing (ES/EN)

## ES

### Objetivo
Extender marketplace para publishers de terceros con:
- registro + verificacion basica,
- upload de bundle firmado,
- pipeline de revision automatica,
- aprobacion/rechazo manual en control-plane,
- metadata de revenue share.

### Modelo de datos (Control Plane)
Nuevos modelos:
- `Publisher`
  - `name`, `email`, `website`
  - `verificationStatus` (`PENDING|VERIFIED|REJECTED`)
  - `apiKey`, `signingSecret`
  - `defaultRevenueShareBps`
- `PluginSubmission`
  - `publisherId`, `pluginName`, `version`, `channel`
  - `bundleUrl`, `manifest`, `signature`
  - `requestedPermissions`, `dependencies`
  - `status` (`UNDER_REVIEW|REJECTED_POLICY|APPROVED|REJECTED`)
  - `reviewReport`
  - `revenueShareBps` (metadata)

Se extiende `PluginRelease` con:
- `publisherId`, `sourceSubmissionId`
- `permissions`, `dependencies`
- `reviewStatus`

Migracion:
- `apps/control-plane/prisma/migrations/20260212_plugin_publishing/migration.sql`

### Pipeline de revision
Implementado en:
- `apps/control-plane/app/lib/plugin-review.ts`

Etapas:
1. **Analisis estatico**
   - valida permisos solicitados contra allowlist
   - rechaza dependencias bloqueadas (`child_process`, `node-pty`, `shelljs`, `vm2`)
2. **Security scan (SAST/Trivy simulado determinista)**
   - findings por patrones de riesgo en manifest/deps/url
3. **Sandbox test automatico**
   - escenario determinista por plugin/version/canal

Decision:
- `APPROVE` / `REJECT` con razones trazables en `reviewReport`.

### Firma de bundle
Helpers:
- `signPluginPayload(payload, secret)`
- `verifyPublisherBundleSignature(payload, signature, signingSecret)`

Archivo:
- `apps/control-plane/app/lib/plugin-marketplace.ts`

### API Control Plane
Publishers:
- `GET /api/plugins/publishers`
- `POST /api/plugins/publishers`
- `POST /api/plugins/publishers/:id/verify`

Submissions:
- `GET /api/plugins/submissions`
- `POST /api/plugins/submissions`
- `POST /api/plugins/submissions/:id/review` (`approve|reject`)

Releases:
- `GET /api/plugins/releases`
- `POST /api/plugins/releases` (manual/admin fallback)

### UI
Pantalla unificada:
- `apps/control-plane/app/plugins/page.tsx`

Secciones:
- Publisher registration
- Publisher verification
- Upload signed bundle
- Review pipeline + approve/reject
- Releases + compatibilidad

### Tests
- `apps/control-plane/app/lib/plugin-publishing.spec.ts`

Cubre:
- firma valida/invalida
- rechazo por permisos no permitidos
- rechazo por policy de dependencias bloqueadas

## EN

### Goal
Extend plugin marketplace with third-party publisher support:
- registration + basic verification,
- signed bundle upload,
- automated review pipeline,
- manual approve/reject in control-plane,
- optional revenue-share metadata.

### Data model (Control Plane)
New models:
- `Publisher`
  - `name`, `email`, `website`
  - `verificationStatus` (`PENDING|VERIFIED|REJECTED`)
  - `apiKey`, `signingSecret`
  - `defaultRevenueShareBps`
- `PluginSubmission`
  - `publisherId`, `pluginName`, `version`, `channel`
  - `bundleUrl`, `manifest`, `signature`
  - `requestedPermissions`, `dependencies`
  - `status` (`UNDER_REVIEW|REJECTED_POLICY|APPROVED|REJECTED`)
  - `reviewReport`
  - `revenueShareBps` (metadata only)

`PluginRelease` extended with:
- `publisherId`, `sourceSubmissionId`
- `permissions`, `dependencies`
- `reviewStatus`

Migration:
- `apps/control-plane/prisma/migrations/20260212_plugin_publishing/migration.sql`

### Review pipeline
Implemented at:
- `apps/control-plane/app/lib/plugin-review.ts`

Stages:
1. **Static analysis**
   - validates requested permissions against allowlist
   - rejects blocked dependencies (`child_process`, `node-pty`, `shelljs`, `vm2`)
2. **Security scan (deterministic SAST/Trivy simulation)**
   - findings from risky patterns in manifest/dependencies/url
3. **Automated sandbox test**
   - deterministic scenario id by plugin/version/channel

Decision:
- `APPROVE` / `REJECT` with reasons persisted in `reviewReport`.

### Bundle signature
Helpers:
- `signPluginPayload(payload, secret)`
- `verifyPublisherBundleSignature(payload, signature, signingSecret)`

File:
- `apps/control-plane/app/lib/plugin-marketplace.ts`

### Control Plane API
Publishers:
- `GET /api/plugins/publishers`
- `POST /api/plugins/publishers`
- `POST /api/plugins/publishers/:id/verify`

Submissions:
- `GET /api/plugins/submissions`
- `POST /api/plugins/submissions`
- `POST /api/plugins/submissions/:id/review` (`approve|reject`)

Releases:
- `GET /api/plugins/releases`
- `POST /api/plugins/releases` (manual/admin fallback)

### UI
Unified page:
- `apps/control-plane/app/plugins/page.tsx`

Sections:
- Publisher registration
- Publisher verification
- Upload signed bundle
- Review pipeline + approve/reject
- Releases + compatibility

### Tests
- `apps/control-plane/app/lib/plugin-publishing.spec.ts`

Covers:
- valid/invalid signature
- reject on unauthorized permissions
- reject on blocked dependency policy
