# Product Packages

## Overview
Product packages apply a curated set of:
- Feature flags
- Recommended themes
- Email templates
- Dashboard templates
- Report templates

Packages are applied via:
- `POST /admin/starter-packs/apply` with `packageId`
- Provisioning flag `--product-package`

## Packages
### Bebidas (base)
- `packageId`: `bebidas_base`
- Features: `enableOwnDelivery`
- Themes: Admin `A`, Storefront `A`
- Includes beverage catalog + attributes

### Bebidas + Mayorista
- `packageId`: `bebidas_mayorista`
- Features: `enableOwnDelivery`
- Themes: Admin `B`, Storefront `B`
- Adds wholesale dashboards/reports
- Includes beverage catalog + attributes

### Bebidas + Marketplaces
- `packageId`: `bebidas_marketplaces`
- Features: `enableMercadoLibre`, `enableAndreani`
- Themes: Admin `C`, Storefront `B`
- Adds marketplace dashboards/reports
- Includes beverage catalog + attributes

### Bebidas + ARCA
- `packageId`: `bebidas_arca`
- Features: `enableAfip`
- Themes: Admin `A`, Storefront `C`
- Adds fiscal dashboards/reports and invoice email
- Includes beverage catalog + attributes

## API
List packages:
```
GET /admin/starter-packs/packages
```

Apply package:
```
POST /admin/starter-packs/apply
{
  "packageId": "bebidas_base"
}
```

## Provisioning
```
pnpm provision:instance --name acme --domain acme.com --product-package bebidas_base
```

## Notes
- Package application is additive. It does not delete existing templates or dashboards.
- Feature flags are applied in `CompanySettings`.
