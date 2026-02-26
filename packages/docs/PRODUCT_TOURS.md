# Product Tours (ES/EN)

## ES

### Objetivo
Agregar tours guiados en `admin` y `storefront` para mejorar activación y adopción de features.

### Modelo
Persistido en `control-plane`:
- `ProductTour`
  - `surface`: `ADMIN | STOREFRONT`
  - `locale`
  - `status`
  - `condition` (JSON)
  - `triggerType` + `triggerConfig`
- `ProductTourStep`
  - `order`
  - `title`
  - `body`
  - `targetSelector`
  - `locale`
  - `condition` (JSON)
- `ProductTourEvent`
  - `STARTED | COMPLETED | ABANDONED`
  - contexto: `instanceId`, `role`, `icp`, `locale`, `surface`, `path`

### Condiciones y triggers
Condiciones (`condition` JSON):
- `rolesIn`
- `icpIn`
- `localesIn`
- `pathPrefixes`

Triggers:
- `FIRST_TIME`
- `FEATURE_UNUSED` (`featureKey`, `minCount`)
- `TRIAL_NEARING_END` (`daysRemainingLte`)
- `ALWAYS`

### Apps (admin/storefront)
- Runners clientes (`ProductToursRunner`) integrados en `layout`
- Fetch a `/api/product-tours` (proxy al control-plane)
- Tracking a `/api/product-tours/track`
- Persistencia local de vistos/completados en `localStorage`

### Control-plane
- Editor simple: `/product-tours`
- API admin: `GET/POST /api/product-tours`
- API pública:
  - `GET /api/product-tours/public`
  - `POST /api/product-tours/track`
- Dashboard muestra:
  - métricas de started/completed/abandoned
  - correlación con Activation Score (impacto en activación)

### Tracking / eventos
Se trackean:
- `TourStarted`
- `TourCompleted`
- `TourAbandoned`

Además se persiste `ProductTourEvent` en control-plane para reporting.

### Tests
- selección/render prep de tours + condiciones/triggers
- tracking/event builder
- persistencia tracking en control-plane

---

## EN

### Goal
Add guided tours to `admin` and `storefront` to improve activation and feature adoption.

### Model
Persisted in `control-plane`:
- `ProductTour`
  - `surface`: `ADMIN | STOREFRONT`
  - `locale`
  - `status`
  - `condition` (JSON)
  - `triggerType` + `triggerConfig`
- `ProductTourStep`
  - `order`
  - `title`
  - `body`
  - `targetSelector`
  - `locale`
  - `condition` (JSON)
- `ProductTourEvent`
  - `STARTED | COMPLETED | ABANDONED`
  - context: `instanceId`, `role`, `icp`, `locale`, `surface`, `path`

### Conditions and triggers
Conditions (`condition` JSON):
- `rolesIn`
- `icpIn`
- `localesIn`
- `pathPrefixes`

Triggers:
- `FIRST_TIME`
- `FEATURE_UNUSED` (`featureKey`, `minCount`)
- `TRIAL_NEARING_END` (`daysRemainingLte`)
- `ALWAYS`

### Apps (admin/storefront)
- Client runners (`ProductToursRunner`) integrated in app `layout`
- Fetch from `/api/product-tours` (proxy to control-plane)
- Track to `/api/product-tours/track`
- Local seen/completed persistence in `localStorage`

### Control-plane
- Simple editor: `/product-tours`
- Admin API: `GET/POST /api/product-tours`
- Public APIs:
  - `GET /api/product-tours/public`
  - `POST /api/product-tours/track`
- Dashboard includes:
  - started/completed/abandoned metrics
  - correlation with Activation Score (activation impact)

### Tracking / events
Tracked events:
- `TourStarted`
- `TourCompleted`
- `TourAbandoned`

`ProductTourEvent` is also persisted in control-plane for reporting.

### Tests
- tour render-prep selection + conditions/triggers
- tracking/event builder
- control-plane tracking persistence

