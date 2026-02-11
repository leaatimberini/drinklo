# Search Engine (ES)

## Objetivo
Motor de búsqueda dedicado para catálogo con autocompletado, sugerencias y corrección de typos.

## Stack
- Meilisearch como motor de búsqueda.
- Indexación por BullMQ (jobs incremental + full).

## Servicios
- Meilisearch en `http://meilisearch:7700` (configurable con `MEILI_HOST`).
- `MEILI_API_KEY` opcional.

## Índices
Se usa un índice por empresa:
- `catalog_<companyId>`

Documentos indexados:
- `variant` (producto + variante, SKU/barcode)
- `category`
- `brand`

## Sinónimos
Configurar en Admin → Search Config. Formato JSON:
```
{
  "coca": ["coca cola", "cocacola"],
  "gaseosa": ["soda"]
}
```

## Boosters
Configurables por pesos:
- `stockWeight`: prioriza stock disponible.
- `marginWeight`: prioriza margen (precio - costo).

Se reflejan en ranking rules: `desc(stockScore)`, `desc(marginScore)`.

## Jobs
- Incremental: cada 5 minutos por Cron.
- Full reindex: endpoint admin.

Endpoints:
- `GET /search?q=` (público)
- `GET /admin/search/config` / `POST /admin/search/config`
- `POST /admin/search/reindex` `{ mode: "full" | "incremental" }`

## Health (agent)
El instance-agent reporta `search_ok` usando `MEILI_HOST`.

---

# Search Engine (EN)

## Goal
Dedicated search engine for catalog with autocomplete, suggestions, and typo tolerance.

## Stack
- Meilisearch as search engine.
- BullMQ for indexing jobs (incremental + full).

## Services
- Meilisearch at `http://meilisearch:7700` (configured via `MEILI_HOST`).
- Optional `MEILI_API_KEY`.

## Indexes
One index per company:
- `catalog_<companyId>`

Indexed documents:
- `variant` (product + variant, SKU/barcode)
- `category`
- `brand`

## Synonyms
Configure in Admin → Search Config. JSON format:
```
{
  "coke": ["coca cola", "cocacola"],
  "soda": ["soft drink"]
}
```

## Boosters
Configurable weights:
- `stockWeight`: prioritizes available stock.
- `marginWeight`: prioritizes margin (price - cost).

Applied as ranking rules: `desc(stockScore)`, `desc(marginScore)`.

## Jobs
- Incremental: every 5 minutes via Cron.
- Full reindex: admin endpoint.

Endpoints:
- `GET /search?q=` (public)
- `GET /admin/search/config` / `POST /admin/search/config`
- `POST /admin/search/reindex` `{ mode: "full" | "incremental" }`

## Health (agent)
Instance-agent reports `search_ok` using `MEILI_HOST`.
