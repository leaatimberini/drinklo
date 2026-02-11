# Mobile App (ES)

## Objetivo
Aplicación móvil para operaciones: consulta de stock por barcode, recepción de mercadería y picking/packing de pedidos.

## Requisitos
- Node 24+
- Expo CLI (`pnpm dlx expo`)
- API corriendo en `http://localhost:3001` (configurable con `EXPO_PUBLIC_API_URL`).

## Configuración
En `apps/mobile/app.json` y env vars:
- `EXPO_PUBLIC_API_URL`: URL del API.

## Flujos
1) **Escaneo barcode**
   - Cámara con ZXing vía `expo-barcode-scanner`.
   - Fallback manual por input.
   - Endpoint: `GET /stock/lookup?code=...`

2) **Recepción de mercadería**
   - Endpoint: `POST /stock/movements/receive`
   - Payload: `variantId`, `locationId`, `quantity`, `reason`.

3) **Picking/Packing**
   - Listado: `GET /fulfillment/orders?status=PAID`
   - Update: `POST /fulfillment/orders/:id/status` con `PACKED` o `SHIPPED`.

## Permisos
- Roles habilitados: `admin`, `manager`, `deposito`, `caja`.
- `stock/*` usa permisos `inventory:read|write`.

## Desarrollo
```
pnpm -C apps/mobile dev
```

## Tests
```
pnpm -C apps/mobile test
```

## E2E Smoke
No se ejecuta automáticamente sin emulador/dispositivo. Manual:
1. `pnpm -C apps/mobile dev`
2. Abrir en Expo Go
3. Ejecutar un lookup, recepción y cambio de estado.

---

# Mobile App (EN)

## Goal
Mobile app for operations: barcode stock lookup, receiving inventory, and order picking/packing.

## Requirements
- Node 24+
- Expo CLI (`pnpm dlx expo`)
- API running on `http://localhost:3001` (configurable via `EXPO_PUBLIC_API_URL`).

## Configuration
In `apps/mobile/app.json` and env vars:
- `EXPO_PUBLIC_API_URL`: API base URL.

## Flows
1) **Barcode scan**
   - Camera scanning using ZXing via `expo-barcode-scanner`.
   - Manual fallback input.
   - Endpoint: `GET /stock/lookup?code=...`

2) **Receiving**
   - Endpoint: `POST /stock/movements/receive`
   - Payload: `variantId`, `locationId`, `quantity`, `reason`.

3) **Picking/Packing**
   - List: `GET /fulfillment/orders?status=PAID`
   - Update: `POST /fulfillment/orders/:id/status` with `PACKED` or `SHIPPED`.

## Permissions
- Allowed roles: `admin`, `manager`, `deposito`, `caja`.
- `stock/*` uses `inventory:read|write` permissions.

## Development
```
pnpm -C apps/mobile dev
```

## Tests
```
pnpm -C apps/mobile test
```

## E2E Smoke
Not automated without emulator/device. Manual:
1. `pnpm -C apps/mobile dev`
2. Open in Expo Go
3. Run lookup, receive, and status update.
