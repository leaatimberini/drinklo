# Proposal Builder (ES/EN)

## ES

### Objetivo
Generar propuestas/SOW del proveedor con:
- templates por plan (`C1/C2/C3`) y add-ons
- variables de alcance, tiempos, costos y exclusiones
- export PDF firmado
- evidencia en `ComplianceEvidence`

### Modelos (control-plane)
- `ProposalTemplate`
  - template reusable con `sections` (JSON)
  - filtros por `planTier` y `addonKeys`
  - `variablesSchema`, `pricingDefaults`
- `ProposalDocument`
  - propuesta generada (payload renderizado)
  - pricing summary, manifest, firma, `pdfHash`
  - referencia a `ComplianceEvidence` (`evidenceId`)

### Flujo
1. Crear/editar template SOW (o usar templates default seed)
2. Cargar variables (`scope`, `timeline`, `costs`, `exclusions`)
3. Definir pricing (base + add-ons + descuento)
4. Preview
5. Generar export PDF firmado
6. Guardar evidencia en compliance store

### UI / API
- UI control-plane: `/proposal-builder`
- API:
  - `GET /api/proposal-builder` (dashboard + historial)
  - `POST /api/proposal-builder`:
    - `upsertTemplate`
    - `preview`
    - `generate`
  - `GET /api/proposal-builder?proposalId=...&format=pdf`
  - `GET /api/proposal-builder?proposalId=...&format=json`

### Firma y evidencia
- Firma `HMAC-SHA256` sobre manifest (`payloadHash`, `pdfHash`, metadata)
- `ComplianceEvidence.evidenceType = "proposal_builder.export"`
- El PDF es regenerable desde `ProposalDocument.renderedPayload + manifest + signature`

### Limitaciones (v1)
- PDF renderer minimalista (texto estructurado, no layout avanzado)
- Workflow de aprobación/firma comercial humana no incluido
- No envío por email integrado (solo export/download)

## EN

### Goal
Generate provider-side SOW/proposals with:
- templates by plan and add-ons
- scoped variables (scope, timeline, costs, exclusions)
- signed PDF export
- evidence stored in `ComplianceEvidence`

### Data model (control-plane)
- `ProposalTemplate`
  - reusable SOW template with JSON sections
  - `planTier` / `addonKeys` targeting
  - variable schema + pricing defaults
- `ProposalDocument`
  - generated proposal record with rendered payload
  - pricing summary, manifest, signature and `pdfHash`
  - evidence link (`evidenceId`)

### Flow
1. Create/edit template (or use seeded defaults)
2. Fill variables
3. Set pricing (base + add-ons + discount)
4. Preview
5. Generate signed PDF
6. Store evidence in compliance store

### UI / API
- Control-plane UI: `/proposal-builder`
- API:
  - `GET /api/proposal-builder`
  - `POST /api/proposal-builder` (`upsertTemplate`, `preview`, `generate`)
  - `GET /api/proposal-builder?proposalId=...&format=pdf|json`

### Signature & evidence
- HMAC-SHA256 signature over export manifest
- `ComplianceEvidence` records every generated proposal export
- PDF can be regenerated from stored proposal payload + manifest/signature

### v1 limitations
- Minimal PDF renderer (text-first)
- No human approval workflow built-in
- No outbound email delivery integration

