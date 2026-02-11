# Integrations

Common interface in `packages/integrations/src/types.ts`:
- `orders.pull()`
- `orders.ack()`
- `status.push()`
- `catalog.sync()`

Adapters:
- Mercado Libre: `packages/integrations/src/mercadolibre.ts`
- Rappi: `packages/integrations/src/rappi.ts`
- PedidosYa: `packages/integrations/src/pedidosya.ts`

Docs:
- `packages/integrations/docs/mercadolibre.md`
- `packages/integrations/docs/rappi.md`
- `packages/integrations/docs/pedidosya.md`
