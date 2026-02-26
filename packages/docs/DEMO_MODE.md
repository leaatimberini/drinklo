# Demo Mode (ES/EN)

## ES

### Objetivo
Permitir resetear instancias **demo** a un snapshot controlado sin riesgo de borrar datos de clientes reales.

### Snapshot demo (v1)
El reset repuebla:
- catálogo (categorías, productos, variantes, precios, stock)
- clientes + direcciones
- pedidos demo (created/paid)
- campañas marketing base

Endpoint de instancia (admin):
- `POST /admin/sandbox/demo-reset`
- alias legacy sigue siendo `POST /admin/sandbox/reset` (misma protección)

### Protección anti-borrado
En la **instancia**:
- el reset solo corre si `CompanySettings.sandboxMode = true`
- si no, devuelve error `demo_mode_reset_disabled_for_non_sandbox_company`

En **control-plane**:
- acción disponible vía `POST /api/demo/reset`
- requiere confirmación textual `RESET DEMO`
- valida heurísticas de demo (`instanceId/domain/clientName/releaseChannel` con hints `demo|sandbox`)
- registra evidencia en `ComplianceEvidence`

### UI control-plane
- página `/demo-mode`
- botón **Reset demo instance**
- pide `instanceId`, `apiBaseUrl` (opcional), `adminToken`, confirmación

### Notas
- El reset no es para producción.
- No borra configuración global de compañía, pero deja `sandboxMode=true`.
- Ideal para demos comerciales y QA funcional.

## EN

### Goal
Reset **demo** instances to a known snapshot while preventing destructive resets on real customer tenants.

### Demo snapshot (v1)
Reset repopulates:
- catalog (categories, products, variants, pricing, stock)
- customers + addresses
- demo orders (created/paid)
- baseline marketing campaigns

Instance admin endpoint:
- `POST /admin/sandbox/demo-reset`
- legacy alias remains `POST /admin/sandbox/reset` (same protection)

### Anti-destructive safeguards
On the **instance**:
- reset only runs if `CompanySettings.sandboxMode = true`
- otherwise returns `demo_mode_reset_disabled_for_non_sandbox_company`

On the **control-plane**:
- action exposed via `POST /api/demo/reset`
- requires typed confirmation `RESET DEMO`
- validates demo heuristics (`instanceId/domain/clientName/releaseChannel`)
- writes audit evidence to `ComplianceEvidence`

### Control-plane UI
- `/demo-mode`
- **Reset demo instance** button with explicit confirmation

### Notes
- Not intended for production tenants.
- Company settings are preserved; `sandboxMode` remains enabled.
- Useful for sales demos and repeatable QA showcases.

