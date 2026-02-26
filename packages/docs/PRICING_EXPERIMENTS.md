# Pricing Experiments (ES)

## Objetivo
Experimentos de pricing del proveedor para trials/conversiones:
- variantes por tier (`C1`, `C2`, opcional `C3`)
- ofertas (ej. `20% off x 3 meses`)
- asignacion estable por lead/trial (`cookie + email domain`)
- resultados (conversion, ARPA, churn temprano)
- aplicacion de oferta en billing con expiracion y auditoria

## Modelo (control-plane)
- `PricingExperiment`
  - target tier, filtros (campañas trial, ICP), rango de fechas, status
- `PricingExperimentVariant`
  - peso (weighted split), config JSON (`offer`, badge, etc.)
- `PricingExperimentAssignment`
  - asignacion estable por `experimentId + stickyKeyHash`
  - links a `LeadAttribution`, `TrialRedemption`, `BillingAccount`
  - grant/expiracion/consumo de oferta

## Asignacion estable
Seed estable por experimento:
- `pxid` cookie (persistente)
- `emailDomain`
- `trialCode`

Se calcula `stickyKeyHash` y se hace weighted assignment por variante.
Si existe asignacion previa para ese hash, se reutiliza.

## Integraciones
### Signup / Trial
- `POST /api/signup`
  - asigna experimento al lead/trial
  - al crear `BillingAccount`, concede oferta (si corresponde)
  - setea cookie `pxid`

### Marketing lead capture
- `POST /api/marketing-site/lead`
  - asigna experimento en etapa lead si hay `trialCode` y tier resoluble
  - setea cookie `pxid`

### Billing (aplicacion de oferta)
- `POST /api/billing/invoices`
- `POST /api/billing` (`kind=changePlan`, prorrateo)

Si existe oferta activa:
- aplica descuento (% sobre monto base)
- respeta expiracion y max ciclos
- registra evidencia en `ComplianceEvidence`

## Control-plane UI
Ruta sugerida: `/pricing-experiments`
- editor JSON de experimentos/variantes
- preview de asignacion estable
- resultados por variante:
  - conversion
  - ARPA
  - churn temprano
  - past due / restricted

## API (control-plane)
- `GET/POST /api/pricing-experiments`
- `GET /api/pricing-experiments/results`

## Config de variante (ejemplo)
```json
{
  "offer": {
    "percentOff": 20,
    "billingCycles": 3,
    "expiresDays": 120,
    "label": "20% OFF x 3 meses"
  }
}
```

## Anti-abuso
- asignacion estable deduplicada por `experimentId + stickyKeyHash`
- oferta no se aplica si:
  - expiro
  - se agotaron ciclos
  - no fue concedida

## Tests
- asignacion estable (mismo seed => misma variante)
- expiracion de oferta
- no abuso (ciclos agotados)

---

# Pricing Experiments (EN)

## Purpose
Provider-side pricing experiments for trial/conversion flows:
- tier variants (`C1`, `C2`, optionally `C3`)
- offers (e.g. `20% off for 3 months`)
- stable assignment by lead/trial (`cookie + email domain`)
- results (conversion, ARPA, early churn)
- billing offer application with expiration and audit

## Data model (control-plane)
- `PricingExperiment`
- `PricingExperimentVariant`
- `PricingExperimentAssignment`

Assignments are stable and deduplicated by `experimentId + stickyKeyHash`.

## Stable assignment
Seed uses:
- persistent `pxid` cookie
- `emailDomain`
- `trialCode`

Weighted variant assignment is deterministic for the same seed.

## Integrations
### Signup / Trial
`POST /api/signup` assigns experiment variants and grants offers (when a billing account is created), and sets `pxid`.

### Marketing lead capture
`POST /api/marketing-site/lead` assigns experiments at lead stage (when a `trialCode` resolves to a target tier), and sets `pxid`.

### Billing offer application
Offers are applied on invoice creation / proration flows when active and valid. Expiration and max billing cycles are enforced. Evidence is stored in `ComplianceEvidence`.

## Control-plane UI
Suggested route: `/pricing-experiments`
- JSON editor for experiments/variants
- stable assignment preview
- per-variant results:
  - conversion
  - ARPA
  - early churn
  - past due / restricted

## API (control-plane)
- `GET/POST /api/pricing-experiments`
- `GET /api/pricing-experiments/results`

## Example variant config
```json
{
  "offer": {
    "percentOff": 20,
    "billingCycles": 3,
    "expiresDays": 120,
    "label": "20% OFF for 3 months"
  }
}
```

## Anti-abuse
Offers are not applied when expired, not granted, or billing cycles are exhausted.

## Tests
- stable assignment
- offer expiration
- no-abuse (exhausted cycles)
