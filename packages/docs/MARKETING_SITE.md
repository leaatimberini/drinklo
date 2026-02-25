# Marketing Site (ES/EN)

## ES

### Objetivo
`apps/marketing-site` es el sitio comercial público para la vertical **Bebidas**:

- landing para `Retail`, `Distribuidora`, `Enterprise`
- `/pricing` leyendo del **Pricing Catalog** del proveedor (control-plane)
- CTA `Probar 30 días` con `?trial=CODE` opcional
- captura de leads (email + tipo de negocio + ciudad)
- atribución UTM/referral persistida en control-plane

### Rutas principales

- `/` landing comercial
- `/pricing` planes `C1/C2/C3`
- `/signup` formulario de lead/trial (lee `?trial=CODE`)
- `/api/pricing` proxy/cache a control-plane
- `/api/lead` proxy lead capture -> control-plane
- `/api/signup` proxy trial signup (con código) o lead-only (sin código)
- `/api/events` ingest básico de analytics events (stub local)

### Integración con control-plane

Control-plane endpoints usados:

- `GET /api/pricing-catalog/public`
- `POST /api/marketing-site/lead`
- `POST /api/signup` (cuando hay trial code)

Persistencia:

- `MarketingLead` (nuevo modelo en control-plane)
- `LeadAttribution` (UTM/referral/landing/businessType)

### Variables de entorno (`apps/marketing-site/.env.example`)

- `CONTROL_PLANE_URL`
- `MARKETING_SITE_INGEST_TOKEN` (opcional, si el control-plane lo exige)
- `NEXT_PUBLIC_MARKETING_SITE_URL`
- `NEXT_PUBLIC_CONTROL_PLANE_URL`

### SEO / Performance / Analytics

- `Metadata` por página (Home/Pricing/Signup)
- fetch server-side con `revalidate` para pricing
- CSS liviano y sin dependencias de UI pesadas
- eventos de analytics (`page_view`, `cta_click`, `lead_submit`, etc.) vía `/api/events`

### Tests

- `apps/marketing-site/app/lib/marketing-site.test.ts` (links + payloads/helpers)
- `apps/marketing-site/app/api/marketing-site-endpoints.test.ts` (endpoints básicos)
- build de app con `next build`

---

## EN

### Goal
`apps/marketing-site` is the public commercial site for the **Beverages** vertical:

- landing for `Retail`, `Distributor`, `Enterprise`
- `/pricing` reading from provider **Pricing Catalog**
- `Try 30 days` CTA with optional `?trial=CODE`
- lead capture (email + business type + city)
- UTM/referral attribution stored in control-plane

### Main routes

- `/`
- `/pricing`
- `/signup`
- `/api/pricing`
- `/api/lead`
- `/api/signup`
- `/api/events`

### Control-plane integration

Uses:
- `GET /api/pricing-catalog/public`
- `POST /api/marketing-site/lead`
- `POST /api/signup` (trial code flow)

Stored in control-plane:
- `MarketingLead`
- `LeadAttribution`

### Env vars

See `apps/marketing-site/.env.example`.

### SEO / Performance / Analytics

- page metadata
- server-side pricing fetch with revalidation
- lightweight CSS / minimal client JS
- basic analytics events via `/api/events` stub

### Tests

- helper/link tests
- basic endpoint tests
- app build

