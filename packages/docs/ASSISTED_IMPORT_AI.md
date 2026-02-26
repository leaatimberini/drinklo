# Assisted Import AI (ES/EN)

## ES

### Objetivo
Agregar un flujo de importacion asistida para CSV/XLSX con:
- sugerencia de mapeo de columnas (heuristica local / mock IA)
- preview y validacion
- dry-run antes de importar
- templates de mapping por ICP (ej. `bebidas`)

### Endpoints (API instancia)
- `POST /admin/import/assist/analyze` (multipart `file`, `type`, `icp?`, `columnMappingJson?`)
- `GET /admin/import/assist/templates?type=...&icp=...`
- `POST /admin/import/assist/templates`
- `DELETE /admin/import/assist/templates/:id`
- `POST /admin/import` (ya existente, ahora acepta `columnMappingJson`, `mappingTemplateName`, `saveMappingTemplate`)

### UI Admin
- Ruta: `apps/admin/app/import-assist/page.tsx`
- Flujo:
1. subir archivo CSV/XLSX
2. analizar y revisar mapping sugerido
3. ajustar mapping manualmente
4. correr dry-run
5. importar
6. guardar template por ICP

### Motor de sugerencia (mock IA local)
- determinista
- normaliza headers (minusculas, sin tildes)
- usa aliases de negocio (bebidas/kiosco/distribuidora)
- calcula confianza por match exacto / alias / tokens
- no bloquea: el usuario puede corregir manualmente

### Persistencia de templates
- Implementacion v1: archivo local JSON en `./.data/import-mapping-templates.json` (por `companyId`, `type`, `icp`, `name`)
- Pensado para reemplazo futuro por tabla Prisma si se requiere multi-node

### Validacion / reporte
- reutiliza validaciones existentes del modulo `import-export`
- reporte incluye:
  - `count`
  - `errors`
  - `previewRaw`
  - `previewMapped`
  - `canImport`

### Tests
- `apps/api/src/modules/import-export/assisted-import.service.spec.ts`
- cubre mapping determinista (fixture bebidas) y fallback seguro

## EN

### Goal
Provide an assisted CSV/XLSX import flow with:
- column mapping suggestions (local heuristic / mock AI)
- preview and validation
- dry-run before import
- mapping templates by ICP (e.g. `bebidas`)

### Endpoints (instance API)
- `POST /admin/import/assist/analyze` (multipart `file`, `type`, `icp?`, `columnMappingJson?`)
- `GET /admin/import/assist/templates?type=...&icp=...`
- `POST /admin/import/assist/templates`
- `DELETE /admin/import/assist/templates/:id`
- `POST /admin/import` (existing; now accepts `columnMappingJson`, `mappingTemplateName`, `saveMappingTemplate`)

### Admin UI
- Route: `apps/admin/app/import-assist/page.tsx`
- Flow:
1. upload CSV/XLSX
2. analyze and review suggested mapping
3. adjust mapping manually
4. run dry-run
5. import
6. save template by ICP

### Suggestion engine (local mock AI)
- deterministic
- normalizes headers (lowercase, accent-insensitive)
- uses domain aliases (bebidas/kiosco/distribuidora)
- computes confidence via exact match / alias / token overlap
- non-blocking: user can always override mapping

### Template persistence
- v1 implementation: local JSON file at `./.data/import-mapping-templates.json` (keyed by `companyId`, `type`, `icp`, `name`)
- Can be migrated later to Prisma for multi-node deployments

### Validation / report
- reuses existing `import-export` validations
- report includes:
  - `count`
  - `errors`
  - `previewRaw`
  - `previewMapped`
  - `canImport`

### Tests
- `apps/api/src/modules/import-export/assisted-import.service.spec.ts`
- covers deterministic mapping (bebidas fixture) and safe fallback

