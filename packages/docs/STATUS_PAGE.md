# Status Page (ES/EN)

## ES

### Objetivo
`apps/status-page` expone una **Status Page pública** para clientes consumiendo métricas agregadas del `control-plane` (SLOs, uptime, latencias) e incidentes publicados.

### Estados públicos
- `Operational`
- `Degraded`
- `Partial Outage`
- `Major Outage`

El estado se deriva de:
- health agregado de instancias
- métricas SLO (p95, error rate, webhook retry rate)
- incidentes públicos activos

### Incidentes
- Creación y gestión desde `apps/control-plane` (`/status-page-admin`)
- Timeline de updates públicos/privados
- Publicación de incidente
- Cierre de incidente
- Publicación de postmortem (plantilla automática al cerrar)

Endpoints control-plane:
- `GET /api/status-page/public/summary`
- `GET /api/status-page/public/incidents`
- `GET /api/status-page/public/incidents/:slug`
- `POST /api/status-page/public/subscribe`
- `GET/POST /api/status-page/incidents` (admin)

### Suscripciones
- Email
- Webhook (opcional para clientes)

Notas:
- La entrega real es `mock/auditable` en esta versión.
- Se registra evidencia de batch en `ComplianceEvidence` (`status_page.notification_batch`).

### Seguridad / permisos
- Gestión de incidentes sólo vía endpoints admin (`isAdminRequest`)
- APIs públicas sólo leen datos publicados (`isPublic=true`)

### Tests y validación
- `apps/status-page`:
  - build
  - tests de rutas proxy e index/helpers
- `apps/control-plane`:
  - test de permisos (401 en admin route)
  - test de workflow de publicación/cierre/postmortem

### Configuración
- `CONTROL_PLANE_URL` en `apps/status-page` para consumir APIs públicas del control-plane.

---

## EN

### Goal
`apps/status-page` provides a **public status page** that consumes aggregated `control-plane` metrics (SLOs, uptime, latency) and published incidents.

### Public states
- `Operational`
- `Degraded`
- `Partial Outage`
- `Major Outage`

Status is derived from:
- aggregated instance health
- SLO metrics (p95, error rate, webhook retry rate)
- active public incidents

### Incidents
- Created and managed from `apps/control-plane` (`/status-page-admin`)
- Public/private timeline updates
- Incident publishing
- Incident closing
- Postmortem publishing (auto template generated on close)

Control-plane endpoints:
- `GET /api/status-page/public/summary`
- `GET /api/status-page/public/incidents`
- `GET /api/status-page/public/incidents/:slug`
- `POST /api/status-page/public/subscribe`
- `GET/POST /api/status-page/incidents` (admin)

### Subscriptions
- Email
- Webhook (optional for customers)

Notes:
- Delivery is `mock/auditable` in this version.
- Batch evidence is recorded in `ComplianceEvidence` (`status_page.notification_batch`).

### Security / permissions
- Incident management is admin-only (`isAdminRequest`)
- Public APIs only expose published data (`isPublic=true`)

### Tests and validation
- `apps/status-page`:
  - build
  - route proxy and helper/index tests
- `apps/control-plane`:
  - permissions test (401 on admin route)
  - publish/close/postmortem workflow test

### Configuration
- Set `CONTROL_PLANE_URL` in `apps/status-page` to read public control-plane APIs.

