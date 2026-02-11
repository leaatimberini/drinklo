# Andreani Adapter (Developers)

## Scope
This project uses the Andreani Developers (Globallpack) APIs for:
- **Login**: obtain token
- **Quote**: cotizador
- **Create**: pre-envio (ordenes de envio)
- **Track**: trazabilidad

## Endpoints (default env values)
- `ANDREANI_LOGIN_URL`: `https://apis.andreani.com/login`
- `ANDREANI_COTIZADOR_URL`: `https://apis.andreanigloballpack.com/cotizador-globallpack/api/v1/Cotizador`
- `ANDREANI_PREENVIO_URL`: `https://apis.andreanigloballpack.com/altapreenvio-globallpack/api/v1/ordenes-de-envio`
- `ANDREANI_TRACKING_URL`: `https://apis.andreanigloballpack.com/trazabilidad-globallpack/api/v1/Envios`

## Authentication
- The login endpoint uses **Basic Auth** (`username:password`) and returns a token.
- The token must be sent in the `x-authorization-token` header for subsequent calls.

## Quote (Cotizador)
The adapter builds a query with destination and origin data:
- `CpDestino`, `CiudadDestino`, `PaisDestino`
- `CpOrigen`, `CiudadOrigen`, `PaisOrigen`
- `Contrato`, `Cliente` (if available)
- `bultos[0].kilos`, `bultos[0].volumen`, `bultos[0].categoriaProducto`

The API returns a total price (`tarifaConIva.total`) used in the checkout.

## Create shipment (Pre-envio)
- The adapter sends a minimal JSON body with `Origen` and `Destino` postal data.
- Response is parsed for `numeroEnvio` / `numeroAndreani`.

## Tracking
- Tracking uses `/Envios/{trackingCode}/trazas`.
- Response is mapped to `status` and `history` in the adapter.

## Implementation
- Adapter: `apps/api/src/modules/checkout/adapters/andreani.adapter.ts`
- Shipping service: `apps/api/src/modules/checkout/shipping.service.ts`
- Env vars: `apps/api/.env.example`

## Notes
The Globallpack APIs are used for reference. If your account uses different Andreani endpoints, replace the env URLs accordingly.
