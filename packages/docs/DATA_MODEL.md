# Data Model

## Conventions
- All models use `id` as UUID primary key.
- Timestamps: `createdAt`, `updatedAt` (`@updatedAt`), and `deletedAt` for soft deletes where applicable.
- Multi-tenant: most tables include `companyId` and are indexed by it.

## Core Entities
- Company: tenant root.
- User: belongs to Company and Role.
- Role: belongs to Company; grants Permissions through RolePermission.
- Permission: belongs to Company; referenced by RolePermission.
- Customer: belongs to Company; has many Addresses.
- Address: belongs to Customer and Company.

## Catalog
- Category: belongs to Company; supports parent/child hierarchy.
- Product: belongs to Company; has many Variants.
- ProductVariant: belongs to Product and Company; includes `sku` and optional `barcode`.
- ProductCategory: join table for Product <-> Category.

## Pricing
- PriceList: belongs to Company; e.g., Retail/Wholesale.
- PriceRule: belongs to PriceList and Company; can target Product or Variant with `price` + `minQty`.

## Inventory
- StockLocation: belongs to Company.
- StockItem: ties Variant to Location; current `quantity`.
- StockMovement: immutable ledger of changes to StockItem.

## Key Indexes
- SKU and barcode are indexed in ProductVariant.
- `productId` indexed in ProductVariant, PriceRule.
- `companyId` indexed across tenant-scoped tables.
