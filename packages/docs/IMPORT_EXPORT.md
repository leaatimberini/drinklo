# Import / Export

Supports CSV/XLSX import with validation, preview, and dry-run. Export provides CSV with matching columns.

## Endpoint
- `POST /admin/import` (multipart `file` + JSON body)
- `GET /admin/import/export?type=...`

Body for import:
```
{
  "type": "products|variants|prices|stock|customers",
  "dryRun": true
}
```

## Types and columns
### Products
Required:
- `name`

Optional:
- `description`
- `imageUrl`
- `sku` (creates default variant)
- `barcode`
- `variantName`
- `isAlcoholic` (true/false)
- `abv` (number)

### Variants / Barcodes
Required:
- `productId`
- `sku`

Optional:
- `name`
- `barcode`

### Prices (per price list)
Required:
- `priceList`
- `variantSku`
- `price`

### Stock (initial)
Required:
- `variantSku`
- `location`
- `quantity`

### Customers + addresses
Required:
- `name`

Optional:
- `email`
- `phone`
- `line1`, `line2`, `city`, `state`, `postalCode`, `country`

## Validation + preview
- If validation fails, response includes `errors` and `preview` and does not import.
- `dryRun=true` returns preview only.

## Export
`GET /admin/import/export?type=products` returns CSV with matching columns.

## Fixtures
Test fixtures live in `tests/fixtures/imports`.
