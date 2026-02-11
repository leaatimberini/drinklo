# Demand Forecasting (ES)

## Objetivo
Generar pronóstico de demanda por producto usando ventas históricas, estacionalidad y promociones.

## Dataset
- Ventas POS (`SaleItem` + `Sale`).
- Ventas ecommerce (`OrderItem` + `Order`).
- Promoción: si hay `discount`/`couponCode`.
- Estacionalidad: día de semana y mes.

## Modelo
Regresión lineal con:
- Intercepto
- Tendencia temporal
- Promo flag
- One-hot día de semana
- One-hot mes

Fallback: promedio histórico si no hay datos suficientes.

## Output
- Forecast por producto para 7/14/30 días.
- `reorderPoint` = demanda media * lead time + safety stock.
- `reorderQuantity` = max(0, demanda en lead time + reorderPoint - stock actual).

## Endpoint
- `GET /admin/forecasting?horizonDays=7|14|30`

## UI
Admin → “Compras sugeridas” con export CSV.

---

# Demand Forecasting (EN)

## Goal
Generate product-level demand forecasts using historical sales, seasonality, and promotions.

## Dataset
- POS sales (`SaleItem` + `Sale`).
- Ecommerce sales (`OrderItem` + `Order`).
- Promotion flag from `discount`/`couponCode`.
- Seasonality: day of week and month.

## Model
Linear regression with:
- Intercept
- Time trend
- Promo flag
- One-hot day of week
- One-hot month

Fallback: historical average when data is insufficient.

## Output
- Per-product forecast for 7/14/30 days.
- `reorderPoint` = avg demand * lead time + safety stock.
- `reorderQuantity` = max(0, lead time demand + reorderPoint - current stock).

## Endpoint
- `GET /admin/forecasting?horizonDays=7|14|30`

## UI
Admin → “Suggested purchases” with CSV export.
