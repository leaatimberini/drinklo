# Accessibility / Accesibilidad (WCAG)

## ES

### Alcance
- Auditoria automatica con `axe-core` en Playwright para:
  - `home`
  - `category`
  - `PDP`
  - `cart`
  - `checkout`
  - `login`
  - `dashboard`
- Gate de calidad: el test falla si hay violaciones `critical`.

### Comandos
```bash
pnpm install
pnpm e2e --grep "axe audit"
```

Variables opcionales:
- `A11Y_API_URL` (default `http://localhost:3001`)
- `A11Y_STOREFRONT_URL` (default `http://localhost:3003`)
- `A11Y_ADMIN_URL` (default `http://localhost:3002`)
- `A11Y_CONTROL_PLANE_URL` (default `http://localhost:3010`)

### Reporte a Control Plane
El test puede enviar score por instancia/version:
- Endpoint: `POST /api/accessibility/report`
- Auth: header `x-cp-ingest-token`
- Payload minimo:
```json
{
  "instanceId": "inst-001",
  "version": "1.2.3",
  "score": 96,
  "criticalViolations": 0,
  "seriousViolations": 2,
  "totalViolations": 4,
  "pages": []
}
```

Variables para ingest:
- `CONTROL_PLANE_INGEST_TOKEN`
- `A11Y_REPORT_URL` (default `http://localhost:3010/api/accessibility/report`)
- `A11Y_INSTANCE_ID` (default `local-dev`)
- `A11Y_VERSION` (default `GIT_SHA` o `dev`)

### Fixes incluidos
- Focus visible consistente (`:focus-visible`) en `storefront`, `admin`, `control-plane`.
- `Skip link` para navegacion por teclado.
- Labels explicitos en formularios de checkout.
- Correccion de semantica en carrito (link/boton).
- Tokens de contraste para textos secundarios.

### Vista en Control Plane
- UI: `/accessibility`
- API admin: `GET /api/accessibility/report?limit=100`
- Muestra score por `instanceId`, `version` y conteo de violaciones.

## EN

### Scope
- Automated `axe-core` audits in Playwright for:
  - `home`
  - `category`
  - `PDP`
  - `cart`
  - `checkout`
  - `login`
  - `dashboard`
- Quality gate: test fails on `critical` violations.

### Commands
```bash
pnpm install
pnpm e2e --grep "axe audit"
```

Optional variables:
- `A11Y_API_URL` (default `http://localhost:3001`)
- `A11Y_STOREFRONT_URL` (default `http://localhost:3003`)
- `A11Y_ADMIN_URL` (default `http://localhost:3002`)
- `A11Y_CONTROL_PLANE_URL` (default `http://localhost:3010`)

### Control Plane Reporting
The test can send score per instance/version:
- Endpoint: `POST /api/accessibility/report`
- Auth: `x-cp-ingest-token`
- Minimal payload:
```json
{
  "instanceId": "inst-001",
  "version": "1.2.3",
  "score": 96,
  "criticalViolations": 0,
  "seriousViolations": 2,
  "totalViolations": 4,
  "pages": []
}
```

Ingest variables:
- `CONTROL_PLANE_INGEST_TOKEN`
- `A11Y_REPORT_URL` (default `http://localhost:3010/api/accessibility/report`)
- `A11Y_INSTANCE_ID` (default `local-dev`)
- `A11Y_VERSION` (default `GIT_SHA` or `dev`)

### Included fixes
- Consistent visible focus (`:focus-visible`) in `storefront`, `admin`, `control-plane`.
- Keyboard `skip link`.
- Explicit checkout field labels.
- Cart semantic fix (link/button structure).
- Contrast tokens for secondary text.

### Control Plane view
- UI: `/accessibility`
- Admin API: `GET /api/accessibility/report?limit=100`
- Shows score by `instanceId`, `version`, and violation counts.
