# Multi-Branch

## Overview
Adds multi-branch support within a company:
- Multiple branches (sucursales/depósitos)
- Stock by branch
- Shipping zones by branch
- Optional price lists by branch
- Branch-based permissions (UserBranch)

## Data model
Key models:
- `Branch` (company-level branches)
- `UserBranch` (assign users to allowed branches)
- `StockLocation.branchId`
- `StockItem.branchId`
- `StockMovement.branchId`
- `ShippingZone.branchId`
- `Order.branchId`
- `PriceList.branchId` (optional)

## Checkout
- `QuoteRequestDto` and `CreateOrderDto` accept `branchId`.
- Pickup options return branch list.
- Delivery quotes use shipping zones per branch.

## Permissions by branch
`UserBranch` allows restricting users to specific branches. Enforcement can be added in controllers/services (filter by branchId).

## Seed/Setup
- Default branch created in setup/seed.
- Shipping zones created per branch in seed.

## Notes
- Branch fields are nullable for backward compatibility. New data should set `branchId`.
- Extend admin UI to manage branches and user-branch assignments as needed.
