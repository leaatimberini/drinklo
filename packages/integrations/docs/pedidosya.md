# PedidosYa Integration

## Official Docs
- Developer portal (Order Management API): https://integrar.pedidosya.com/
- Developer portal (sign-up): https://developers.pedidosya.com/

## Scope
- Order Management API
- Webhook receiver
- Status updates

## Checklist
- [ ] Register in the PedidosYa developer portal
- [ ] Obtain API key / credentials
- [ ] Configure webhook endpoints and signing (per portal)
- [ ] Implement `orders.pull()` or webhook handler
- [ ] Implement `orders.ack()` if required
- [ ] Implement `status.push()`
- [ ] Implement `catalog.sync()` if enabled

## Adapter Skeleton
File: `packages/integrations/src/pedidosya.ts`
