# Mercado Libre Integration

## Official Docs
- Receive notifications (topics and callback URL): https://developers.mercadolibre.com.ar/devsite/receive-notifications
- Shipments resource: https://developers.mercadolibre.com.mx/en_us/api-docs/shipment-handling
- Orders example (order + shipment id): https://developers.mercadolibre.com.ar/en_us/nodejs/custom-shipping

## Scope
- Notifications subscription
- Fetch orders and shipments
- Acknowledge orders and push status (if applicable to the resource)
- Catalog sync (listings)

## Checklist
- [ ] Create Mercado Libre application and get `client_id` / `client_secret`
- [ ] Configure notification callback URL and topics (orders/shipments/items)
- [ ] Implement OAuth token flow + refresh
- [ ] Store `user_id` (seller) and `access_token`
- [ ] Implement `/notifications` handler and idempotency
- [ ] Implement `orders.pull()` using `/orders` search + `/orders/{id}`
- [ ] Implement `shipments` fetch using `/shipments/{id}`
- [ ] Implement status push (if required by shipment flow)
- [ ] Catalog sync (listings)

## Adapter Skeleton
File: `packages/integrations/src/mercadolibre.ts`
