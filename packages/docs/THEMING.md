# Theming

## Overview
Themes are template-based (A/B/C) and stored in `CompanySettings` as `storefrontTheme` and `adminTheme`. The API returns a tokenized theme for each app, and the frontend applies CSS variables.

## Templates
Each template includes:
- Colors: background, foreground, primary, secondary, accent, muted
- Typography: body and heading font families
- Radii: sm/md/lg
- Components: button and card tokens

Templates live in:
- `apps/api/src/modules/themes/theme.templates.ts`

## API
- `GET /themes/public`: returns active theme tokens for admin + storefront
- `PATCH /themes`: updates `adminTheme` and `storefrontTheme` (requires `settings:write`)

## Storage
`CompanySettings` fields:
- `storefrontTheme`
- `adminTheme`

## Frontend
Both `apps/admin` and `apps/storefront` call `/themes/public` and map tokens to CSS variables:
- `--color-*`, `--font-*`, `--radius-*`, `--button-*`, `--card-*`

The provider files:
- `apps/admin/app/theme-provider.tsx`
- `apps/storefront/app/theme-provider.tsx`

## Admin Selector
Admin page includes a theme selector (requires JWT with `settings:write`). It issues a `PATCH /themes` call.
