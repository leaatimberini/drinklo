# Offline POS (ES)

## Objetivo
Permitir operar el POS del admin sin conexión (PWA), con catálogo cacheado en IndexedDB y cola de ventas offline.

## Cómo funciona
- El admin registra un Service Worker y un `manifest.json` para instalar como app.
- El POS mantiene un catálogo local en IndexedDB (`erp-pos`).
- Las ventas offline se guardan como borradores con `clientTxnId` y se sincronizan cuando vuelve Internet.

## Flujo de sincronización
1. El POS crea un `clientTxnId` por venta.
2. Si está offline, guarda el borrador en IndexedDB.
3. Al volver online, envía los drafts a `POST /sales/offline/sync`.
4. El backend procesa idempotente usando `clientTxnId`.

## Endpoints
- `GET /sales/offline/catalog` → catálogo completo para cache local.
- `POST /sales/offline/sync` → sincroniza ventas offline.
- `POST /sales` → ventas online con `clientTxnId` opcional.

## Política de conflictos
- El servidor es fuente de verdad para stock y precio.
- Si no hay stock suficiente, la venta queda en cola y se reporta como `failed`.
- Los precios se recalculan en el backend con la lista de precios activa.

## Persistencia local
- IndexedDB `erp-pos`
  - `catalog`: cache de catálogo.
  - `drafts`: ventas offline (cola).
  - `meta`: `lastSync`, `lastCatalogSync`.

## Seguridad
- Los endpoints requieren JWT y roles `admin`, `manager` o `caja`.
- En ambientes productivos, usar tokens de corta duración.

## Operación
- Botón “Actualizar catálogo” para refrescar cache.
- Indicador Online/Offline y tamaño de cola.

---

# Offline POS (EN)

## Goal
Enable offline POS operation in admin (PWA) with an IndexedDB catalog cache and an offline sales queue.

## How it works
- The admin registers a Service Worker and `manifest.json` to install as an app.
- POS keeps a local catalog in IndexedDB (`erp-pos`).
- Offline sales are stored with a `clientTxnId` and synced when back online.

## Sync flow
1. POS generates a `clientTxnId` per sale.
2. If offline, it stores the draft in IndexedDB.
3. When back online, it sends drafts to `POST /sales/offline/sync`.
4. Backend processes idempotently using `clientTxnId`.

## Endpoints
- `GET /sales/offline/catalog` → full catalog for local cache.
- `POST /sales/offline/sync` → sync offline sales.
- `POST /sales` → online sales with optional `clientTxnId`.

## Conflict policy
- Server is the source of truth for stock and price.
- If stock is insufficient, the draft remains queued and is returned as `failed`.
- Prices are recalculated server-side using the active price list.

## Local persistence
- IndexedDB `erp-pos`
  - `catalog`: catalog cache.
  - `drafts`: offline sales queue.
  - `meta`: `lastSync`, `lastCatalogSync`.

## Security
- Endpoints require JWT and roles `admin`, `manager`, or `caja`.
- Use short-lived tokens in production.

## Operation
- “Actualizar catálogo” button refreshes cache.
- Online/Offline indicator and queue size shown in POS.
