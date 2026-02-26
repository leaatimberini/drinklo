# LEAD_SOURCING (ES/EN)

## ES

### Objetivo
Módulo de **Lead Sourcing** en control-plane para:
- importar leads desde CSV
- enriquecer (dedupe, tags ICP, score de potencial)
- integrarlos al CRM interno (Lead/Deal/Stage)
- automatizar tareas comerciales operativas

### CSV soportado (mínimo)
Columnas recomendadas:
- `empresa`
- `rubro`
- `ciudad`
- `contacto` (email / teléfono / nombre)
- `canal`

También soporta aliases básicos (`company`, `city`, `channel`, `email`, `telefono`, etc.).

### Enrichment
- **Deduplicación**
  - por email (`email:<email>`)
  - fallback por `empresa + ciudad`
- **Tags**
  - ICP: `icp:kiosco`, `icp:distribuidora`, `icp:bar`, `icp:enterprise`
  - canal / ciudad / rubro normalizados
  - `source:lead-sourcing`
- **Score de potencial (0-100)**
  - completitud (empresa/contacto/ciudad/canal/rubro)
  - señal ICP
  - canal (partner/inbound/evento mejora score)

### Integración con CRM
Al importar:
- crea o actualiza `CrmLead`
- crea o actualiza `CrmDeal`
- sugiere/aplica stage inicial (`NEW`, `CONTACTED`, `DEMO`)
- registra transición de stage cuando corresponde

### Automatización de tareas (CRM)
Se crean tareas (si no existen abiertas con mismo título):
- `Agendar demo`
- `Crear trial`
- `Enviar pack seguridad`

### Endpoints (control-plane)
- `GET /api/lead-sourcing`
  - historial de imports + últimos leads/deals sincronizados
- `POST /api/lead-sourcing` (multipart)
  - `action=analyze` → preview enrichment
  - `action=import` + `dryRun=true|false`

### UI
- `apps/control-plane/app/lead-sourcing/page.tsx`
- flujo:
  1. subir CSV
  2. analizar preview
  3. dry-run
  4. importar + CRM
  5. revisar historial/evidencia

### Auditoría / evidencia
- cada import real guarda `ComplianceEvidence`
  - `evidenceType = "lead_sourcing_import"`
  - resumen + preview parcial + `payloadHash`

### Tests
- `apps/control-plane/app/lib/lead-sourcing.test.ts`
  - parse/enrichment determinista
  - dedupe key fallback
- `apps/control-plane/app/api/lead-sourcing/lead-sourcing-routes.test.ts`
  - permisos (401 sin auth)

## EN

### Goal
Control-plane **Lead Sourcing** module to:
- import leads from CSV
- enrich (dedupe, ICP tags, potential score)
- integrate them into internal CRM (Lead/Deal/Stage)
- automate operational sales tasks

### Supported CSV (minimum)
Recommended columns:
- `empresa`
- `rubro`
- `ciudad`
- `contacto` (email / phone / name)
- `canal`

Basic aliases are also supported (`company`, `city`, `channel`, `email`, `telefono`, etc.).

### Enrichment
- **Deduplication**
  - by email (`email:<email>`)
  - fallback by `company + city`
- **Tags**
  - ICP: `icp:kiosco`, `icp:distribuidora`, `icp:bar`, `icp:enterprise`
  - normalized source/city/category tags
  - `source:lead-sourcing`
- **Potential score (0-100)**
  - completeness (company/contact/city/channel/category)
  - ICP signal
  - channel quality (partner/inbound/event boosts score)

### CRM Integration
On import:
- create/update `CrmLead`
- create/update `CrmDeal`
- suggest/apply initial stage (`NEW`, `CONTACTED`, `DEMO`)
- record stage transition when applicable

### Automated tasks (CRM)
Creates tasks (if no open task with same title exists):
- `Agendar demo`
- `Crear trial`
- `Enviar pack seguridad`

### Endpoints (control-plane)
- `GET /api/lead-sourcing`
  - import history + recent synced CRM leads/deals
- `POST /api/lead-sourcing` (multipart)
  - `action=analyze` → enrichment preview
  - `action=import` + `dryRun=true|false`

### UI
- `apps/control-plane/app/lead-sourcing/page.tsx`
- flow:
  1. upload CSV
  2. analyze preview
  3. dry-run
  4. import + CRM
  5. review history/evidence

### Audit / evidence
- every real import writes `ComplianceEvidence`
  - `evidenceType = "lead_sourcing_import"`
  - summary + partial preview + `payloadHash`

### Tests
- `apps/control-plane/app/lib/lead-sourcing.test.ts`
  - deterministic parse/enrichment
  - dedupe key fallback
- `apps/control-plane/app/api/lead-sourcing/lead-sourcing-routes.test.ts`
  - permissions (401 without auth)

