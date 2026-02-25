# Marketplace Publico de Plugins v1 / Public Plugin Marketplace v1

## ES

### Objetivo
Marketplace publico (control-plane) para plugins con:
- pagina publica por plugin
- changelog y matriz de compatibilidad por version
- rating/reviews
- revision automatica obligatoria antes de aprobar
- badge `Certified` cuando pasa la bateria

### Flujo
1. Publisher verificado envia `PluginSubmission`.
2. `POST /api/plugins/submissions` ejecuta revision automatica:
   - SAST
   - dependency scan
   - sandbox e2e
   - chequeo permisos solicitados vs usados (`manifest.permissionsUsed`)
3. `POST /api/plugins/submissions/:id/review` (admin) solo aprueba si todos los checks obligatorios pasan.
4. Se crea `PluginRelease` con:
   - `compatibility` y `compatibilityMatrix`
   - `certified`, `certifiedAt`, `certificationReport`
5. Instalacion (`PluginRequest` -> approve) valida compatibilidad de version contra la instancia.

### Endpoints nuevos (public)
- `GET /api/marketplace/plugins`
- `GET /api/marketplace/plugins/:name`
- `POST /api/marketplace/plugins/:name/reviews`

### UI
- Admin/control-plane:
  - `/plugins` muestra badge `Certified` y link a pagina publica
- Publico:
  - `/marketplace`
  - `/marketplace/plugins/:name`

### Compatibilidad
Formato recomendado `compatibilityMatrix`:

```json
[
  { "platformVersion": "0.1.x", "status": "supported", "notes": "validated" },
  { "platformVersion": "0.2.x", "status": "warning", "notes": "smoke only" }
]
```

`status`: `supported | warning | unsupported`

### Limites v1
- Reviews sin moderacion avanzada (se publican directo).
- Scans son deterministas/simulacion policy-first (no ejecutan scanners reales externos).
- Compatibilidad usa matriz explicita o fallback simple por prefijo (`0.1.x`).

## EN

### Goal
Public plugin marketplace (control-plane) with:
- public plugin pages
- changelog + version compatibility matrix
- ratings/reviews
- mandatory automated review checks before approval
- `Certified` badge when the release passes the battery

### Flow
1. Verified publisher submits `PluginSubmission`.
2. `POST /api/plugins/submissions` runs automated review:
   - SAST
   - dependency scan
   - sandbox e2e
   - requested-vs-used permission check (`manifest.permissionsUsed`)
3. `POST /api/plugins/submissions/:id/review` (admin) can approve only when required checks pass.
4. A `PluginRelease` is created with:
   - `compatibility` and `compatibilityMatrix`
   - `certified`, `certifiedAt`, `certificationReport`
5. Install approval validates release compatibility against installation version.

### New public endpoints
- `GET /api/marketplace/plugins`
- `GET /api/marketplace/plugins/:name`
- `POST /api/marketplace/plugins/:name/reviews`

### UI
- Admin/control-plane:
  - `/plugins` shows `Certified` badge and public page link
- Public:
  - `/marketplace`
  - `/marketplace/plugins/:name`

### v1 limitations
- Reviews are direct-publish (no advanced moderation workflow yet).
- Scans are deterministic policy simulation (not external scanners).
- Compatibility uses explicit matrix or simple prefix fallback (`0.1.x`).

