# Customer Health & Churn Signals (ES/EN)

## ES

### Objetivo
Calcular un **Customer Health Score post-activación** por instancia (0–100) para priorizar seguimiento de Customer Success / Ops / Billing y detectar riesgo de churn.

### Score (0–100)
Componentes y ponderación:
- **Uso real (35)**: órdenes, POS, campañas, logins
- **Confiabilidad (20)**: incidentes, errores, job failures, alerts, SLOs
- **Pago / billing risk (20)**: `PAST_DUE`, días vencidos, warnings, soft/hard limits
- **Feedback (15)**: NPS/CSAT + issues abiertos
- **Integraciones (10)**: conectores activos, fallos 24h, DLQ

### Estados
- `HEALTHY` (`>= 75`)
- `WATCH` (`50–74`)
- `AT_RISK` (`< 50`)

### Dashboard (control-plane)
Ruta:
- `apps/control-plane/app/customer-health/page.tsx`

API:
- `GET /api/customer-health`
- `POST /api/customer-health` con `action=runAutomations`

Salida:
- resumen por estado
- alertas derivadas (motivos)
- score por instancia
- playbooks sugeridos (no automáticos)

### Automations (At Risk)
Cuando una instancia está `AT_RISK`, el runner:
1. Crea **tarea interna** (`CrmDealTask`) si existe deal CRM para la instalación.
2. Crea **Alert** interna (dedupe 24h).
3. Genera **mock email al CSM** (si existe email de owner o env default) y lo registra en `ComplianceEvidence`.

Notas:
- No ejecuta playbooks en automático; solo sugiere.
- Dedupe por día BA para tareas y por payloadHash para email mock.

### Config opcional
- `CUSTOMER_HEALTH_DEFAULT_CSM_EMAIL`: fallback cuando el `ownerUserId` del CRM no es email válido.

### Tests
- cálculo determinista con fixtures (`healthy` vs `at risk`)
- automations con dedupe (task/alert/email)

---

## EN

### Goal
Compute a **post-activation Customer Health Score** per instance (0–100) to prioritize Customer Success / Ops / Billing follow-up and detect churn risk.

### Score (0–100)
Components and weights:
- **Real usage (35)**: orders, POS, campaigns, logins
- **Reliability (20)**: incidents, errors, job failures, alerts, SLOs
- **Payment / billing risk (20)**: `PAST_DUE`, overdue days, warnings, soft/hard limits
- **Feedback (15)**: NPS/CSAT + open issues
- **Integrations (10)**: active connectors, 24h failures, DLQ

### States
- `HEALTHY` (`>= 75`)
- `WATCH` (`50–74`)
- `AT_RISK` (`< 50`)

### Dashboard (control-plane)
Route:
- `apps/control-plane/app/customer-health/page.tsx`

API:
- `GET /api/customer-health`
- `POST /api/customer-health` with `action=runAutomations`

Output:
- state summary
- derived alerts (reasons)
- per-instance score
- suggested playbooks (non-automatic)

### Automations (At Risk)
When an instance is `AT_RISK`, the runner:
1. Creates an **internal task** (`CrmDealTask`) if a CRM deal exists for the installation.
2. Creates an internal **Alert** (24h dedupe).
3. Generates a **mock CSM email** (if owner/default email exists) and stores it in `ComplianceEvidence`.

Notes:
- Playbooks are suggested only; not executed automatically.
- Dedupe uses BA day key for tasks and payload hash for mock email evidence.

### Optional config
- `CUSTOMER_HEALTH_DEFAULT_CSM_EMAIL`: fallback when CRM `ownerUserId` is not a valid email.

### Tests
- deterministic scoring fixtures (`healthy` vs `at risk`)
- automation dedupe (task/alert/email)

