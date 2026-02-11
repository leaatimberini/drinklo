# Runbooks

## Caída DB (Postgres)
1. Verificar estado del contenedor: `docker compose ps`.
2. Revisar logs: `docker compose logs -f postgres`.
3. Chequear espacio en disco y volumen (`erp_pgdata`).
4. Si el servicio no levanta, restaurar último backup:
   - `BACKUP_ID=<id> pnpm restore:run`.
5. Validar API `/health` y `/version`.

## Webhooks duplicados
1. Verificar `WebhookLog` (provider + eventId) para ver si el evento fue procesado.
2. Confirmar idempotencia en handler (revisar `eventId`).
3. Si se duplicó, corregir manualmente estado de pago/orden y registrar auditoría.

## Reintentos de jobs
1. Identificar job fallido en `/admin/ops`.
2. Revisar logs del worker/queue.
3. Reintentar manualmente si es idempotente.
4. Si persiste, deshabilitar módulo afectado (feature flag) temporalmente.

## Problemas de impresión
1. Verificar `print-agent` corriendo y conectado al WS local.
2. Revisar cola de impresión (jobs pendientes).
3. Probar “Print Preview” desde POS.
4. Reiniciar agente o servicio local si el socket no responde.

## Problemas del bot
1. Revisar `BOT_TOKEN`, `BOT_ALLOWLIST` y endpoint webhook.
2. Confirmar conectividad con API.
3. Revisar auditoría de comandos en DB.
4. Si hay rate limits, subir `BOT_ALLOWLIST` o ajustar rate limiting.

# Soporte

## Recolección de logs
- `pnpm deploy:logs` o logs del servicio afectado.
- Descargar bundle: `GET /admin/ops/diagnostic?limit=50`.

## Backup antes de cambios
- `pnpm backup:run` y guardar ID generado.

## Datos a solicitar al cliente
- Timestamp aproximado
- Usuario afectado
- Acción ejecutada
- Evidencia (captura/log)
