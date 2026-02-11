# Rappi Integration

## Official Links
- Integrations Manager: https://integrations-manager.rappi.com/
- Merchant integrations info (links to Dev Portal): https://rappi.merchants.freshdesk.com/support/solutions/articles/36000235828-integrations-api-

## Scope
- Auth flow placeholder
- Orders pull/ack
- Status push
- Catalog sync

## Checklist
- [ ] Request access to Rappi Dev Portal via Integrations Manager
- [ ] Obtain client credentials (client_id/client_secret) and merchant identifiers
- [ ] Confirm auth flow (OAuth/client-credentials) and token refresh
- [ ] Define order webhook/polling strategy
- [ ] Implement `orders.pull()`
- [ ] Implement `orders.ack()`
- [ ] Implement `status.push()`
- [ ] Implement `catalog.sync()`

## Adapter Skeleton
File: `packages/integrations/src/rappi.ts`
