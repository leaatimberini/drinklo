# Delivery Routing (ES)

## Objetivo
Optimizar reparto propio con rutas diarias, ventanas horarias y tracking por parada.

## Modelos
- `DeliveryWindow`: ventana horaria (start/end).
- `DeliveryRoute`: ruta del día, asignación de repartidor.
- `DeliveryStop`: paradas con estado y métricas.

## Heurística VRP (básica)
1. Filtra pedidos con `shippingProvider=OWN` y `status=PAID|PACKED`.
2. Agrupa por zona (ShippingZone) y ventana horaria.
3. Ordena paradas con nearest-neighbor usando distancia Haversine.

## Endpoints
- `GET /admin/delivery/windows`
- `POST /admin/delivery/windows`
- `GET /admin/delivery/routes?date=YYYY-MM-DD`
- `POST /admin/delivery/routes/generate`
- `POST /admin/delivery/stops/:id/status`

## Export a Google Maps
El admin genera un link con las direcciones en orden de parada.

## Tracking y notificaciones
- Cada cambio de estado en `DeliveryStop` crea un `OrderStatusEvent`.
- Se registra un `EmailEventLog` con `type=delivery_stop_status` como stub de notificación.

---

# Delivery Routing (EN)

## Goal
Optimize own delivery with daily routes, time windows, and per-stop tracking.

## Models
- `DeliveryWindow`: time window (start/end).
- `DeliveryRoute`: daily route with driver assignment.
- `DeliveryStop`: stops with status and metrics.

## Heuristic VRP (basic)
1. Filter orders with `shippingProvider=OWN` and `status=PAID|PACKED`.
2. Group by zone (ShippingZone) and time window.
3. Order stops using nearest-neighbor and Haversine distance.

## Endpoints
- `GET /admin/delivery/windows`
- `POST /admin/delivery/windows`
- `GET /admin/delivery/routes?date=YYYY-MM-DD`
- `POST /admin/delivery/routes/generate`
- `POST /admin/delivery/stops/:id/status`

## Export to Google Maps
Admin generates a link with stop addresses in order.

## Tracking and notifications
- Each `DeliveryStop` status change creates an `OrderStatusEvent`.
- `EmailEventLog` is written with `type=delivery_stop_status` as a notification stub.
