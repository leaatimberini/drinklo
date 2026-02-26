# CASE_STUDIES (ES/EN)

## ES

### Objetivo
Generar casos de éxito automáticamente (borradores) usando señales reales del control-plane:
- activación y uso
- NPS/CSAT
- notas del deal CRM (si existen)

El flujo exige **aprobación manual** antes de publicar.

### Workflow
1. **Generar borrador** (control-plane)
2. **Editar** título/resumen/contenido/métricas presentadas
3. **Aprobar**
4. **Publicar** (marketing site)

### Modelado (control-plane DB)
- `CaseStudy`
  - `status`: `DRAFT | APPROVED | PUBLISHED | ARCHIVED`
  - `slug`, `title`, `summary`, `locale`
  - `content` (context/problem/solution/metricsBeforeAfter/stack/timing)
  - `metrics` (before/after/highlights)
  - `sourceSnapshot` (insumos usados al generar)
  - `approvedAt/by`, `publishedAt/by`

### Fuentes para generación automática
- `Activation Score` (`activation-score`)
- `FeatureUsageSample` (uso real)
- `FeedbackSurveyResponse` (NPS/CSAT)
- `CrmDeal` + `CrmDealNote` (si existe)
- `BillingAccount` (plan, órdenes, GMV, provider)

### Endpoints (control-plane)
- Admin:
  - `GET /api/case-studies`
  - `POST /api/case-studies` (`action=generate`)
  - `GET /api/case-studies/:id`
  - `PATCH /api/case-studies/:id`
  - `POST /api/case-studies/:id` (`action=approve|publish`)
- Público (marketing site):
  - `GET /api/case-studies/public`
  - `GET /api/case-studies/public?slug=...`

### UI
- Control-plane editor: `apps/control-plane/app/case-studies/page.tsx`
- Marketing site:
  - `apps/marketing-site/app/case-studies/page.tsx`
  - `apps/marketing-site/app/case-studies/[slug]/page.tsx`

### Aprobación obligatoria
- Si `approvalRequired = true` y no hay `approvedAt`, publicar devuelve `approval_required`.

### Evidencia / auditoría
- Generación, aprobación y publicación guardan `ComplianceEvidence` con `payloadHash` + firma HMAC del manifest.

### Tests
- `apps/control-plane/app/lib/case-studies.test.ts`
  - generación determinista con fixtures
  - aprobación obligatoria antes de publicar

## EN

### Goal
Automatically generate draft customer success stories from real control-plane signals:
- activation and usage
- NPS/CSAT
- CRM deal notes (if available)

Publishing requires **manual approval**.

### Workflow
1. **Generate draft** (control-plane)
2. **Edit** title/summary/content/metrics
3. **Approve**
4. **Publish** (marketing site)

### Data model (control-plane DB)
- `CaseStudy`
  - `status`: `DRAFT | APPROVED | PUBLISHED | ARCHIVED`
  - `slug`, `title`, `summary`, `locale`
  - `content` (context/problem/solution/metricsBeforeAfter/stack/timing)
  - `metrics` (before/after/highlights)
  - `sourceSnapshot` (inputs used for generation)
  - `approvedAt/by`, `publishedAt/by`

### Automatic generation sources
- `Activation Score`
- `FeatureUsageSample`
- `FeedbackSurveyResponse` (NPS/CSAT)
- `CrmDeal` + `CrmDealNote` (if available)
- `BillingAccount` (plan, orders, GMV, provider)

### Endpoints (control-plane)
- Admin:
  - `GET /api/case-studies`
  - `POST /api/case-studies` (`action=generate`)
  - `GET /api/case-studies/:id`
  - `PATCH /api/case-studies/:id`
  - `POST /api/case-studies/:id` (`action=approve|publish`)
- Public (marketing site):
  - `GET /api/case-studies/public`
  - `GET /api/case-studies/public?slug=...`

### UI
- Control-plane editor: `apps/control-plane/app/case-studies/page.tsx`
- Marketing site:
  - `apps/marketing-site/app/case-studies/page.tsx`
  - `apps/marketing-site/app/case-studies/[slug]/page.tsx`

### Mandatory approval
- If `approvalRequired = true` and `approvedAt` is missing, publish returns `approval_required`.

### Evidence / audit
- Draft generation, approval and publish create `ComplianceEvidence` with `payloadHash` + HMAC-signed manifest.

### Tests
- `apps/control-plane/app/lib/case-studies.test.ts`
  - deterministic generation with fixtures
  - approval required before publish

