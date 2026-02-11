# Disaster Recovery

Automatizacion de DR drills con medicion de RPO/RTO y alertas.

## Metricas

- **RPO** (Recovery Point Objective): minutos desde el ultimo backup valido.
- **RTO** (Recovery Time Objective): minutos para restaurar + correr smoke.

## Planes y objetivos sugeridos

- starter: RPO 1440m (24h), RTO 480m (8h)
- standard: RPO 720m (12h), RTO 240m (4h)
- pro: RPO 240m (4h), RTO 120m (2h)
- enterprise: RPO 60m (1h), RTO 60m (1h)

## DR Drill Automatico

Script:

```
pnpm dr:drill
```

Variables:

- `CONTROL_PLANE_DATABASE_URL` (obligatorio)
- `DR_INSTANCE_ID` (opcional, si no usa el ultimo heartbeat)
- `DR_PLAN` (starter|standard|pro|enterprise)
- `DR_RPO_TARGET_MIN` / `DR_RTO_TARGET_MIN` (opcional override)
- `DR_DATABASE_URL` / `DR_REDIS_URL` (entorno aislado)
- `BACKUP_ID` o `BACKUP_PATH` (backup a restaurar)
- `BACKUP_DIR`, `BACKUP_ENCRYPTION_KEY`, `REDIS_RESTORE`

El drill:
1. Elige instancia.
2. Restaura en entorno aislado (usa `scripts/restore.mjs`).
3. Corre smoke (`pnpm smoke` dentro del restore).
4. Mide RTO y calcula RPO.
5. Reporta y crea alertas si se exceden objetivos.

## Alertas

Se crean alertas en control-plane si:
- `RPO > RPO target`
- `RTO > RTO target`

## Control-plane

Se guarda historial en `DisasterRecoveryDrill` y resumen en `Installation`:

- `lastDrillAt`, `lastDrillStatus`
- `lastDrillRpoMin`, `lastDrillRtoMin`
- `rpoTargetMin`, `rtoTargetMin`, `drPlan`
