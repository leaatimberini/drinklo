# AB Testing

Motor basico de experimentos con asignacion estable, metricas y reportes.

## Conceptos

- Experiment: definicion del test (target, objetivos, status).
- Variant: variantes con peso y payload JSON.
- Assignment: asignacion estable por cookie o userId.
- Event: eventos de objetivo (add-to-cart, conversion).

## Targets

- HOME
- PDP
- CHECKOUT

## Objetivos

- ADD_TO_CART
- CONVERSION

## Asignacion estable

La asignacion se basa en:
- userId si se provee
- cookieId si no hay userId

## Cookies

- erp_ab: JSON con { id, assignments }
- Se setea en GET /experiments/assign

## Endpoints

Public:
- GET /experiments/assign?target=HOME|PDP|CHECKOUT
- POST /experiments/event { type, target, orderId? }

Admin:
- GET /admin/experiments
- POST /admin/experiments
- POST /admin/experiments/:id/variants
- GET /admin/experiments/:id/report

## Reporte

El reporte incluye:
- envios (add-to-cart)
- conversiones
- tasa de conversion
- z-test basico contra control

Guardrail:
- muestra minima 50 por variante para significancia.

## Storefront

- Middleware asigna cookie segun path.
- SSR usa experiments/assign para render condicional.
- Eventos:
  - add-to-cart desde PDP
  - conversion desde checkout al crear orden

## Feature flag

CompanySettings.enableAbTesting debe estar en true para activar el modulo.
