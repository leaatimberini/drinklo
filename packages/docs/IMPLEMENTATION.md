# Implementation Module (ES/EN)

## ES

### Objetivo
Módulo de **Implementation** en control-plane para acompañar alta y go-live de una instancia:
- checklist por ICP
- responsables, fechas y estado por tarea
- integración con Activation Score, Product Tours y Academy
- semáforo de go-live readiness + acceso a reporte final firmado

### Modelos (control-plane)
- `ImplementationProject`
  - 1 por instalación
  - ICP, owner, fechas (`kickoff`, `targetGoLive`, `actualGoLive`)
  - estado (`PLANNING`, `IN_PROGRESS`, `READY_FOR_GO_LIVE`, `LIVE`, `BLOCKED`)
- `ImplementationChecklistItem`
  - tareas del checklist con `status`, responsable, `dueAt`, `required`
  - links opcionales a señal de activación / curso academy / tour

### Integraciones
- **Activation Score**
  - se usa para score/estado en readiness
  - sync opcional auto-completa tareas ligadas a señales (`catalog_imported`, `mercadopago_connected`, etc.)
- **Tours**
  - cuenta eventos `STARTED/COMPLETED/ABANDONED` para contexto e impacto
  - puede auto-marcar tareas ligadas a tours (v1: proxy por completados)
- **Academy**
  - muestra progreso/certificados por instancia
  - recomienda cursos para pasos trabados
  - puede auto-marcar tareas ligadas a cursos completados

### Go-live readiness (semáforo)
Semáforo derivado de:
- % checklist requerido completo
- Activation Score / estado
- bloqueos (`BLOCKED`)
- restore verificado (30d)
- DR drill (30d)

Estados:
- `RED`
- `YELLOW`
- `GREEN`

### UI / API
- Página control-plane: `/implementation`
- API:
  - `GET /api/implementation`
  - `POST /api/implementation`
    - `upsertProject`
    - `syncChecklistTemplate`
    - `syncSignals`
    - `updateItem`
    - `generateFinalReport`

### Reporte final
- Reusa el módulo existente de Go-Live Report:
  - JSON: `/api/go-live-report?installationId=...&format=json`
  - PDF firmado: `/api/go-live-report?installationId=...&format=pdf`

## EN

### Goal
**Implementation** module in control-plane to manage onboarding and go-live execution per tenant:
- ICP-specific checklist
- task owners, due dates and statuses
- Activation Score / Product Tours / Academy integration
- go-live readiness semaphore + final signed report

### Data model (control-plane)
- `ImplementationProject`
  - one per installation
  - ICP, owner, kickoff/target/actual go-live dates
  - project lifecycle status
- `ImplementationChecklistItem`
  - task rows with status, owner, due date and required flag
  - optional links to activation signals / academy courses / product tours

### Integrations
- **Activation Score**
  - contributes to readiness scoring
  - optional sync auto-completes signal-linked tasks
- **Product Tours**
  - completion stats shown in implementation dashboard
  - can mark tour-linked tasks complete (v1 proxy)
- **Academy**
  - learner progress/certificates shown per instance
  - recommends courses based on blocked onboarding hints
  - can mark course-linked tasks complete

### Go-live readiness
Semaphore computed from:
- required checklist completion
- activation score/state
- blocked required tasks
- recent restore verification
- recent DR drill

Values:
- `RED`
- `YELLOW`
- `GREEN`

### UI / API
- Control-plane page: `/implementation`
- API:
  - `GET /api/implementation`
  - `POST /api/implementation` actions:
    - `upsertProject`
    - `syncChecklistTemplate`
    - `syncSignals`
    - `updateItem`
    - `generateFinalReport`

### Final report
Uses the existing Go-Live report module:
- JSON preview
- signed PDF output

