# Go-Live Checklist

## Infra / DNS
- [ ] DNS apuntando a VPS (A/AAAA) para storefront, admin, api
- [ ] TLS activo (Caddy/Nginx)
- [ ] Healthcheck `/health` OK
- [ ] `/version` reporta commit y build date

## Base de datos
- [ ] Migraciones aplicadas
- [ ] Backup inicial generado
- [ ] Verificar conexiones (pooling)

## Storage
- [ ] Bucket creado y accesible
- [ ] URLs firmadas funcionando (PDFs)

## Integraciones
- [ ] Mercado Pago credenciales correctas
- [ ] Webhook MP con firma
- [ ] Andreani (si aplica) con credenciales válidas

## Seguridad
- [ ] CORS correcto
- [ ] Rate limiting activo
- [ ] Secrets rotados (JWT, branding, licensing)

## Aplicación
- [ ] Setup inicial completado
- [ ] Admin login OK
- [ ] Catálogo cargado
- [ ] Stock inicial cargado
- [ ] Prueba de checkout OK
- [ ] Prueba de impresión OK (si aplica)
- [ ] Bot conectado y comandos básicos OK

## Observabilidad
- [ ] Sentry/OTel activos
- [ ] `/admin/ops` accesible para admin

## Operación
- [ ] Backups automáticos activos
- [ ] Runbooks compartidos con soporte
