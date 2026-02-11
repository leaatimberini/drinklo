# Promos & Loyalty

Módulo de cupones, gift cards y loyalty con integración en checkout y bot.

## Cupones

Tipos:
- `PERCENT`: descuento porcentual
- `FIXED`: monto fijo
- `FREE_SHIPPING`: envío gratis

Restricciones:
- por lista de precios (`priceListId`)
- por categoría (`categoryId`)
- por cliente (`customerId`)
- fechas (`startsAt`, `endsAt`)
- límites (`usageLimit`, `perCustomerLimit`)
- mínimo de compra (`minSubtotal`)

Endpoints admin:
- `GET /admin/promos/coupons`
- `POST /admin/promos/coupons`
- `POST /admin/promos/coupons/validate`

## Gift Cards

Campos:
- `code`, `initialAmount`, `balance`, `expiresAt`, `status`

Endpoints admin:
- `GET /admin/promos/giftcards`
- `POST /admin/promos/giftcards`
- `GET /admin/promos/giftcards/:code/balance`

## Loyalty

Reglas:
- `EARN_RATE`: puntos por ARS (config `pointsPerArs`)
- `BONUS_PRODUCT`: puntos extra por producto (`pointsPerUnit`)
- `BONUS_CATEGORY`: puntos extra por categoría (`pointsPerUnit`)

Tiers:
- `minPoints` + `multiplier`

Endpoints admin:
- `GET /admin/promos/loyalty/tiers`
- `POST /admin/promos/loyalty/tiers`
- `GET /admin/promos/loyalty/rules`
- `POST /admin/promos/loyalty/rules`

## Checkout

Se aceptan en `POST /checkout/orders`:
- `couponCode`
- `giftCardCode`
- `loyaltyPointsToUse`
- `priceListId`
- `customerId`

Notas:
- `discountTotal` incluye cupón + canje de puntos.
- `giftCardAmount` se aplica luego del descuento.
- Puntos canjeados usan conversión 1 punto = 1 ARS (ajustable).

## Bot

Comandos:
- `/cupon <codigo> <subtotal>` valida cupón.
- `/giftcard_saldo <codigo>` consulta saldo.

## Tests

Tests básicos de reglas y límites en:
- `apps/api/src/modules/promos/promos.service.spec.ts`
