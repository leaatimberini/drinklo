# Recommendations (ES)

## Objetivo
Generar recomendaciones personalizadas usando eventos del negocio y comportamiento de compra.

## Señales
- `ProductViewed`
- `AddToCart`
- `PurchaseCompleted`
- Órdenes históricas (fallback)

## Bloques
1. **Recomprar**
   - Basado en compras anteriores y recencia.
2. **Cross-sell**
   - Co-ocurrencia en pedidos (itemsets frecuentes básico).
3. **Upsell**
   - Productos con mayor margen (precio - costo) y stock.

## Guardrails
- Stock disponible > 0.
- Respeta age gate (no alcohol si no hay verificación).
- Opt-out mediante cookie `reco_opt_out=true` o `optOut=true`.

## Endpoint
`GET /recommendations?blocks=reorder,cross,upsell&limit=6&cartProductIds=...&ageVerified=true&optOut=false`

## Storefront
- SSR-friendly en home, bloques de recomendaciones.
- Botón para ocultar recomendaciones (setea cookie).

---

# Recommendations (EN)

## Goal
Generate personalized recommendations using business events and purchase behavior.

## Signals
- `ProductViewed`
- `AddToCart`
- `PurchaseCompleted`
- Historical orders (fallback)

## Blocks
1. **Reorder**
   - Based on previous purchases and recency.
2. **Cross-sell**
   - Basic co-occurrence in orders (frequent itemsets).
3. **Upsell**
   - Higher margin products with available stock.

## Guardrails
- Available stock > 0.
- Age gate respected (no alcohol without verification).
- Opt-out via cookie `reco_opt_out=true` or `optOut=true`.

## Endpoint
`GET /recommendations?blocks=reorder,cross,upsell&limit=6&cartProductIds=...&ageVerified=true&optOut=false`

## Storefront
- SSR-friendly home blocks.
- Button to hide recommendations (sets cookie).
