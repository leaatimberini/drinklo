# Partner Program (ES/EN)

## ES

### Objetivo
Implementar un programa de partners/referidos del lado proveedor (control-plane) para:
- trackear atribución por UTM + cookie + creación de cuenta,
- detectar fraude básico,
- calcular comisión estimada,
- exponer portal partner con export CSV.

### Modelos
- `Partner`: partner afiliado (slug, contacto, dominio, token de portal hash).
- `ReferralLink`: link/código de referido por partner.
- `Lead`: click/lead atribuido con UTM, cookie, IP, dominio y flags de fraude.
- `Conversion`: conversión atribuida a `BillingAccount`/`Installation`, con comisión estimada acumulada.
- `CommissionPlan`: regla de comisión (`PERCENT_REVENUE`, `FLAT_PER_CONVERSION`, `HYBRID`).

### Tracking / Atribución
- Endpoint `GET /api/partners/ref/:code`
  - registra `Lead`
  - guarda cookie `pp_attr` (leadId + referralCode + UTM)
  - redirige a `target`
- En `POST /api/billing` (`kind=account`)
  - lee cookie `pp_attr` y/o `body.attribution`
  - crea `Conversion` al crear `BillingAccount`
  - marca `Lead` como `CONVERTED`

### Anti-fraude básico
Checks iniciales:
- `same_ip`: mismo IP del click y creación de cuenta
- `same_domain_email`: email de la cuenta comparte dominio con `Partner.websiteDomain`
- `same_domain_site`: dominio de instalación coincide con `Partner.websiteDomain`

Si hay flags:
- `Conversion.status = REVIEW`
- se guarda `fraudScore` + `fraudFlags`

### Comisión (Billing Provider)
- Al crear factura (`/api/billing/invoices` y prorrateos en `/api/billing`)
  - se busca conversión atribuida del `BillingAccount`
  - se incrementa `estimatedRevenueAmount`
  - se incrementa `estimatedCommissionAmount`

### Portal Partner (Control-plane)
- Página: `/partner-portal`
- Requiere `partner` (slug) + `token` (portal token)
- Muestra:
  - leads
  - conversiones
  - comisión estimada
  - export CSV

### APIs relevantes
- `GET /api/partners/ref/:code`
- `GET /api/partners/portal/summary`
- `GET /api/partners/portal/export`
- `GET/POST /api/partners/admin` (admin proveedor)

### Tests implementados
- atribución (cookie + UTM + account creation)
- fraude básico (mismo dominio/IP)
- cálculo de comisión (percent/hybrid)

---

## EN

### Goal
Provider-side partner/referral program in the control-plane to:
- track attribution via UTM + cookie + account creation,
- detect basic fraud,
- calculate estimated commission,
- provide a partner portal with CSV export.

### Models
- `Partner`
- `ReferralLink`
- `Lead`
- `Conversion`
- `CommissionPlan`

### Attribution Flow
- `GET /api/partners/ref/:code`
  - creates a `Lead`
  - stores `pp_attr` cookie
  - redirects to target URL
- `POST /api/billing` (`kind=account`)
  - reads `pp_attr` cookie and/or `body.attribution`
  - creates `Conversion` linked to `BillingAccount`
  - marks `Lead` as converted

### Basic Fraud Checks
- same click IP and account-creation IP
- account email domain matches partner domain
- installation domain matches partner domain

Flagged conversions are stored as `REVIEW` with score + flags.

### Commission Application
When invoices are created (billing invoice endpoint and proration invoices), the billing provider logic:
- finds attributed conversion for the billing account
- accumulates estimated revenue
- accumulates estimated commission

### Partner Portal
- Page: `/partner-portal`
- Auth: `partner` (slug) + portal token
- Shows leads, conversions, estimated commission, CSV export

