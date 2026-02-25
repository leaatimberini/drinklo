# AI RAG Copilot / Copiloto IA con RAG

## ES

### Objetivo
Extender el copiloto IA con:
- **RAG** sobre documentación interna (`packages/docs`, ES/EN) y runbooks
- **knowledge base por instancia** (errores/jobs fallidos recientes desde Ops)
- **enforcement por RBAC/permisos**
- respuestas **Explain & Cite** (siempre con referencias `docId/section`)
- **modo incidentes** con sugerencia de runbook + propuestas de acción con aprobación obligatoria

### Fuentes indexadas (v1)
- Documentación interna `packages/docs/*.md`
- Runbooks/checklists (`RUNBOOKS`, `GO_LIVE_CHECKLIST`, etc.)
- Knowledge base por instancia (dinámica):
  - `OpsService.errors`
  - `OpsService.jobFailures`
  - (si existe) alertas recientes

### RAG y permisos
Scopes internos:
- `docs.general`
- `docs.operations`
- `docs.security`
- `docs.runbooks`
- `kb.instance.incidents`

Reglas de acceso (v1):
- `docs.general`: accesible
- `docs.runbooks` y `kb.instance.incidents`: sólo `admin` / `support` o permiso `settings:write`
- `docs.security`: mismo criterio de acceso privilegiado

### Explain & Cite
Todas las respuestas del copiloto agregan:
- `citations[]` con `docId`, `section`, `sourceType`, `scope`, `score`
- bloque textual `Referencias internas (docId/section)` en `message`

### Modo incidentes
`mode = "incident"` (o prompt con palabras clave de incidente):
- resume errores/jobs fallidos recientes
- sugiere runbook relevante
- puede proponer acción `RUN_INCIDENT_PLAYBOOK`
- la acción **nunca se ejecuta sin aprobación**

### Endpoints
- `POST /admin/copilot/chat`
- `GET /admin/copilot/proposals`
- `POST /admin/copilot/proposals/:id/approve`
- `GET /admin/copilot/rag/status` (estado/preview del índice filtrado por permisos)

### UI Admin
`/copilot`
- selector de modo (`admin` / `incident`)
- visualización de citas internas

## EN

### Goal
Extend the AI copilot with:
- **RAG** over internal docs (`packages/docs`, ES/EN) and runbooks
- **instance knowledge base** (recent ops errors/job failures)
- **RBAC/permission-aware filtering**
- **Explain & Cite** responses (always include `docId/section` refs)
- **incident mode** with runbook suggestion + approval-required action proposals

### Indexed sources (v1)
- Internal markdown docs in `packages/docs/*.md`
- Runbooks/checklists
- Dynamic instance KB:
  - recent `OpsService.errors`
  - recent `OpsService.jobFailures`
  - recent alerts (best-effort if available)

### Incident mode
`mode="incident"` (or incident-like prompt keywords):
- analyzes recent errors/jobs
- suggests a runbook
- proposes `RUN_INCIDENT_PLAYBOOK` action
- actions remain approval-gated

### Notes
- RAG search is lightweight lexical scoring (v1).
- This is internal citation/knowledge retrieval; no external LLM provider is required for the RAG layer.

