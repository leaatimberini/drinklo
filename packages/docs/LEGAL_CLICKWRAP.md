# Legal Clickwrap (ES/EN)

## ES

### Objetivo
Implementar aceptación legal versionada (clickwrap) para:
- signup/trial (obligatorio: `TOS` + `Privacy`)
- Enterprise (admin: `DPA` + `SLA`)

Con evidencia exportable y firmada para auditoría/compliance.

### Modelo de datos
- `LegalDocument`
  - `type`: `TOS | DPA | SLA | PRIVACY`
  - `version`
  - `locale`
  - `content`
  - `effectiveAt`
- `LegalAcceptance`
  - `companyId`
  - `userId`
  - `docType`
  - `version`
  - `acceptedAt`
  - `ipHash`
  - `userAgentHash`
  - referencias opcionales a `Installation` / `BillingAccount`

### Flujos
- **Signup/Trial**
  - UI obliga checkboxes TOS + Privacy
  - backend valida aceptación obligatoria
  - backend resuelve versión vigente por `effectiveAt`
  - backend registra `LegalAcceptance`
- **Enterprise**
  - UI admin/control-plane registra aceptación `DPA`/`SLA`
  - se valida que la cuenta sea enterprise (`C3` / `Enterprise`)

### APIs (control-plane)
- Público:
  - `GET /api/legal-clickwrap/public/signup-docs?locale=es|en`
- Admin:
  - `GET /api/legal-clickwrap/admin?kind=documents`
  - `GET /api/legal-clickwrap/admin?kind=acceptances&instanceId=...`
  - `POST /api/legal-clickwrap/admin` actions:
    - `upsertDocument`
    - `acceptEnterprise`
    - `evidencePack` (ZIP firmado)

### Evidence pack
- ZIP con JSON firmado (`HMAC-SHA256`)
- incluye:
  - instalación / cuenta
  - aceptaciones registradas
  - referencia/versionado de documentos
  - `payloadHash` + `signature`
- se registra en `ComplianceEvidence` como:
  - `evidenceType = legal_clickwrap.acceptance_pack`

### Tests
- obligatoriedad TOS/Privacy
- versionado (se guarda versión vigente)
- signup no continúa sin aceptar

---

## EN

### Goal
Implement versioned legal clickwrap acceptance for:
- signup/trial (required: `TOS` + `Privacy`)
- Enterprise (admin acceptance: `DPA` + `SLA`)

With signed exportable evidence for audit/compliance.

### Data model
- `LegalDocument`
  - `type`: `TOS | DPA | SLA | PRIVACY`
  - `version`
  - `locale`
  - `content`
  - `effectiveAt`
- `LegalAcceptance`
  - `companyId`
  - `userId`
  - `docType`
  - `version`
  - `acceptedAt`
  - `ipHash`
  - `userAgentHash`
  - optional links to `Installation` / `BillingAccount`

### Flows
- **Signup/Trial**
  - UI requires TOS + Privacy checkboxes
  - backend enforces required acceptance
  - backend resolves current effective version by `effectiveAt`
  - backend records `LegalAcceptance`
- **Enterprise**
  - admin/control-plane UI records `DPA`/`SLA` acceptance
  - validates account is enterprise (`C3` / `Enterprise`)

### APIs (control-plane)
- Public:
  - `GET /api/legal-clickwrap/public/signup-docs?locale=es|en`
- Admin:
  - `GET /api/legal-clickwrap/admin?kind=documents`
  - `GET /api/legal-clickwrap/admin?kind=acceptances&instanceId=...`
  - `POST /api/legal-clickwrap/admin` actions:
    - `upsertDocument`
    - `acceptEnterprise`
    - `evidencePack` (signed ZIP)

### Evidence pack
- ZIP with signed JSON (`HMAC-SHA256`)
- includes:
  - installation / account
  - recorded acceptances
  - legal document references and versions
  - `payloadHash` + `signature`
- recorded in `ComplianceEvidence` as:
  - `evidenceType = legal_clickwrap.acceptance_pack`

### Tests
- required TOS/Privacy enforcement
- versioning (current effective version stored)
- signup blocked when acceptance is missing

