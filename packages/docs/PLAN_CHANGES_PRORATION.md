# Plan Changes & Proration / Cambios de Plan y Prorrateo

## ES

### Reglas de cambio de plan
- **Upgrade** (`C1 -> C2/C3`): efectivo inmediato
- **Downgrade** (`C3 -> C2/C1` o `C2 -> C1`): programado para `currentPeriodEnd`
- **Cancelacion**: al fin de ciclo (`cancelAtPeriodEnd`)
- **Reactivacion**: remueve cancelacion programada y mantiene la cuenta

### Soft limits al aplicar downgrade
Si al llegar el proximo ciclo el uso excede quotas del tier destino:
- **no se borra data**
- se marca `Subscription.softLimited = true`
- se guarda snapshot en `Subscription.softLimitSnapshot`
- politica: `DOWNGRADE_QUOTA_EXCEEDED_SOFT_LIMIT`

### Prorrateo (upgrade)
Se generan line items claros:
- credito por tiempo no usado del plan anterior
- cargo prorrateado del nuevo plan

Persistencia:
- `ProrationInvoice`
- `ProrationInvoiceItem`

### API (instance)
- `POST /billing/upgrade` (`targetTier`, `dryRun?`)
- `POST /billing/downgrade` (`targetTier`, `dryRun?`)
- `POST /billing/cancel` (`dryRun?`)
- `POST /billing/reactivate`

Soporte (instance):
- `POST /admin/support/billing/:companyId/upgrade`
- `POST /admin/support/billing/:companyId/downgrade`
- `POST /admin/support/billing/:companyId/cancel`
- `POST /admin/support/billing/:companyId/reactivate`

### UI admin
`/plan-billing` incluye:
- comparacion de tiers (limites + precio mensual)
- preview de cambio con `dryRun`
- confirmacion (upgrade/downgrade)
- vista de downgrade programado

### Control-plane (soporte)
Pagina `/billing/plan-changes` para programar cambios con auditoria en control-plane:
- registra evidencia `ComplianceEvidence` (`support.plan_change`)
- genera `Alert` operativo

> La ejecucion automatica remota puede integrarse con agent/webhook; esta entrega deja la programacion auditada y endpoints de soporte listos en instancia.

### Tests
- upgrade inmediato actualiza tier y genera prorrateo
- downgrade se aplica en proximo ciclo y respeta soft limits (sin borrar data)

---

## EN

### Plan change rules
- **Upgrade** (`C1 -> C2/C3`): immediate effect
- **Downgrade** (`C3 -> C2/C1`, `C2 -> C1`): scheduled for `currentPeriodEnd`
- **Cancel**: end-of-cycle (`cancelAtPeriodEnd`)
- **Reactivate**: clears scheduled cancellation

### Soft limits on downgrade application
If usage exceeds target-tier quotas when the downgrade becomes effective:
- **no data deletion**
- `Subscription.softLimited = true`
- `Subscription.softLimitSnapshot` stores details
- policy code: `DOWNGRADE_QUOTA_EXCEEDED_SOFT_LIMIT`

### Proration (upgrade)
Clear line items are generated:
- credit for unused time on current plan
- prorated charge for the new plan

Stored in:
- `ProrationInvoice`
- `ProrationInvoiceItem`

### API (instance)
- `POST /billing/upgrade` (`targetTier`, `dryRun?`)
- `POST /billing/downgrade` (`targetTier`, `dryRun?`)
- `POST /billing/cancel` (`dryRun?`)
- `POST /billing/reactivate`

Support endpoints (instance):
- `POST /admin/support/billing/:companyId/upgrade`
- `POST /admin/support/billing/:companyId/downgrade`
- `POST /admin/support/billing/:companyId/cancel`
- `POST /admin/support/billing/:companyId/reactivate`

### Admin UI
`/plan-billing` now includes:
- tier comparison (quotas + monthly price)
- dry-run preview
- confirmation flow
- scheduled downgrade visibility

