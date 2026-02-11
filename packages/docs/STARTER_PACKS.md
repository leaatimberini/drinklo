# Starter Packs

## Packs
### Catálogo base bebidas
Incluye:
- Categorías: Bebidas, Cervezas, Vinos, Espirituosas, Sin Alcohol, Aguas, Jugos.
- Definiciones de atributos comunes: Marca, Origen, Estilo, Varietal, Graduación (ABV), IBU, Volumen, Envase.

### Plantillas
Incluye:
- Emails: confirmación de pedido, abandono de carrito, promo (estado DRAFT).
- Dashboard templates (ventas diarias, stock crítico).
- Report templates (ventas, stock).

## API
- `POST /admin/starter-packs/apply` con body:
```
{ "catalog": true, "templates": true }
```

## Provisioning
El script `pnpm provision:instance` acepta:
```
--starter-pack true
```
para importar ambos packs luego del setup.
