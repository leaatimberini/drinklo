# Tax Engine

## ES

## Objetivo
Agregar un motor de impuestos configurable por empresa para checkout y simulación en admin, con cálculo determinista y snapshot auditable persistido en `OrderTaxBreakdown`.

## Modelos (Prisma)
- `TaxProfile`
  - perfil fiscal por `Company`
  - define moneda, modo IVA default (`INCLUDED|EXCLUDED`) y redondeo fiscal
- `TaxRule`
  - reglas por perfil con filtros opcionales por:
  - `productId`
  - `categoryId`
  - ubicación (`locationCountry`, `locationState`, `locationCity`, `postalCodePrefix`)
  - `applyToShipping`
- `OrderTaxBreakdown`
  - snapshot del cálculo aplicado al checkout
  - totales (`iva/perception/withholding/totalTax/totalAmount`)
  - `lines` + `inputSnapshot` JSON (auditoría)

## Reglas soportadas
- `IVA`
  - `priceMode = INCLUDED | EXCLUDED`
- `PERCEPTION`
  - porcentaje sobre base neta imponible (post descuento)
- `WITHHOLDING`
  - porcentaje sobre base neta imponible (post descuento)

## Redondeo fiscal
Configurable en `TaxProfile`:
- `roundingMode`: `HALF_UP | UP | DOWN`
- `roundingScope`: `LINE | TOTAL`
- `roundingIncrement`: ej. `0.01`, `0.05`, `1`

## Checkout (determinista + auditable)
El checkout usa `TaxesService` antes de crear la orden:
1. arma líneas (producto/categorías/cantidad/precio)
2. distribuye descuento proporcionalmente por línea
3. resuelve perfil + reglas activas
4. calcula impuestos (orden estable por `priority,id`)
5. persiste `OrderTaxBreakdown` junto con la orden

Notas:
- IVA incluido se informa en breakdown pero no suma al total pagable (ya está incluido en el precio).
- IVA excluido / percepciones suman.
- Retenciones restan.

## Endpoints admin
- `GET /admin/taxes/profile`
- `PUT /admin/taxes/profile`
- `GET /admin/taxes/rules`
- `PUT /admin/taxes/rules` (bulk replace / soft-delete de reglas omitidas)
- `POST /admin/taxes/simulate` (given cart -> taxes)

## UI Admin
Pantalla: `apps/admin/app/taxes/page.tsx`
- edición de perfil fiscal
- edición de reglas (JSON)
- simulador de carrito

## Ejemplo simulación
```json
{
  "currency": "ARS",
  "shippingCost": 500,
  "discountTotal": 0,
  "address": { "country": "AR", "state": "Buenos Aires", "postalCode": "1425" },
  "items": [
    { "productId": "prod_1", "categoryIds": ["cat_bebidas"], "quantity": 2, "unitPrice": 1500 }
  ]
}
```

## Tests
- `apps/api/src/modules/taxes/taxes.service.spec.ts`
  - IVA excluido
  - IVA incluido
  - múltiples reglas y filtros
  - perfil deshabilitado

## Limitaciones actuales
- Percepciones/retenciones se calculan sobre base neta (sin selector de base por regla todavía).
- Mercado Pago mantiene el armado de ítems actual; el monto persistido de `Payment` usa `OrderTaxBreakdown.totalAmount` cuando existe.

---

## EN

## Goal
Provide a configurable tax engine per company for checkout and admin simulation, with deterministic computation and an auditable snapshot stored in `OrderTaxBreakdown`.

## Prisma models
- `TaxProfile`
  - fiscal profile per `Company`
  - currency, default IVA mode (`INCLUDED|EXCLUDED`), fiscal rounding config
- `TaxRule`
  - profile rules with optional filters by:
  - `productId`
  - `categoryId`
  - location (`locationCountry`, `locationState`, `locationCity`, `postalCodePrefix`)
  - `applyToShipping`
- `OrderTaxBreakdown`
  - persisted checkout tax snapshot
  - totals + `lines` + `inputSnapshot` JSON for auditability

## Supported rule kinds
- `IVA` (`INCLUDED` / `EXCLUDED`)
- `PERCEPTION` (percentage on net taxable base after discounts)
- `WITHHOLDING` (percentage on net taxable base after discounts)

## Fiscal rounding
Configurable on `TaxProfile`:
- `roundingMode`: `HALF_UP | UP | DOWN`
- `roundingScope`: `LINE | TOTAL`
- `roundingIncrement`: e.g. `0.01`, `0.05`, `1`

## Checkout integration
Checkout calls `TaxesService` before order creation and persists `OrderTaxBreakdown` in the same transaction.

Behavior:
- included IVA is reported but does not increase payable total
- excluded IVA / perceptions increase payable total
- withholdings reduce payable total

## Admin endpoints
- `GET /admin/taxes/profile`
- `PUT /admin/taxes/profile`
- `GET /admin/taxes/rules`
- `PUT /admin/taxes/rules`
- `POST /admin/taxes/simulate`

## Admin UI
- `apps/admin/app/taxes/page.tsx`

## Tests
- `apps/api/src/modules/taxes/taxes.service.spec.ts`

