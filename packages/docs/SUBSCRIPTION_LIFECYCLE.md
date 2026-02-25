# Subscription Lifecycle / Ciclo de Vida de Suscripcion

## ES

### Objetivo
Automatizar transiciones de suscripcion por tiempo/estado sin borrar datos:
- `TRIAL_ACTIVE -> GRACE`
- `GRACE -> RESTRICTED`
- `ACTIVE_PAID -> PAST_DUE -> GRACE -> RESTRICTED` (segun politica)

El estado `RESTRICTED` **no elimina datos**; limita capacidades premium/no esenciales.

### Politica por defecto
- Trial: `30` dias
- Grace: `7` dias (`SUBSCRIPTION_LIFECYCLE_GRACE_DAYS`)

### Jobs (BullMQ + cron)
Queue: `subscription-lifecycle`

Jobs:
- `trial-expirer`
- `grace-expirer`
- `past-due-handler`
- `trial-reminder-notifier`

Cron:
- horario (default): `7 * * * *` para transiciones
- diario (default): `15 10 * * *` para recordatorios de trial (`T-7/T-3/T-1`)

Si no hay Redis/queue, el cron ejecuta fallback directo (best effort).

### Notificaciones
Se envian a admins por:
- Email (usuarios con rol `Admin`)
- Telegram (chat IDs configurados por env `SUBSCRIPTION_ALERT_TELEGRAM_CHAT_IDS`)
- Banner en admin (persistido como notificacion interna + render en `/plan-billing`)

Eventos notificados:
- reminders de trial `T-7/T-3/T-1`
- expiracion de trial / inicio de gracia
- `PAST_DUE`
- `GRACE`
- `RESTRICTED`

Idempotencia:
- dedupe por `SubscriptionLifecycleNotification.dedupeKey`

### Auditoria inmutable
Cada transicion registra entrada en `ImmutableAuditLog`:
- categoria `billing`
- action `subscription.lifecycle.transition`
- payload con `fromStatus`, `toStatus`, `actor/job`, timestamps

### Modelo de datos
- `Subscription`
- `SubscriptionLifecycleNotification`
- `PlanEntitlement`
- `UsageCounter`

### Endpoints utiles
- `GET /admin/plans/entitlements` (incluye banners + policy restricted preview)
- `GET /admin/plans/lifecycle/notifications`
- `POST /admin/plans/lifecycle/run/:job` (manual)

### Vars de entorno (opcionales)
- `SUBSCRIPTION_LIFECYCLE_CRON_ENABLED`
- `SUBSCRIPTION_LIFECYCLE_HOURLY_CRON`
- `SUBSCRIPTION_LIFECYCLE_DAILY_CRON`
- `SUBSCRIPTION_LIFECYCLE_GRACE_DAYS`
- `SUBSCRIPTION_ALERT_TELEGRAM_CHAT_IDS`
- `TELEGRAM_BOT_TOKEN`

---

## EN

### Goal
Automate subscription state transitions without deleting data:
- `TRIAL_ACTIVE -> GRACE`
- `GRACE -> RESTRICTED`
- `ACTIVE_PAID -> PAST_DUE -> GRACE -> RESTRICTED` (policy-driven)

`RESTRICTED` does **not** delete data; it only limits premium/non-essential capabilities.

### Default policy
- Trial: `30` days
- Grace: `7` days (`SUBSCRIPTION_LIFECYCLE_GRACE_DAYS`)

### Jobs (BullMQ + cron)
Queue: `subscription-lifecycle`

Jobs:
- `trial-expirer`
- `grace-expirer`
- `past-due-handler`
- `trial-reminder-notifier`

Cron defaults:
- hourly transitions: `7 * * * *`
- daily trial reminders: `15 10 * * *` (`T-7/T-3/T-1`)

Fallback mode runs inline if BullMQ/Redis is unavailable.

### Notifications
Targets:
- Email to admin users
- Telegram chat IDs from `SUBSCRIPTION_ALERT_TELEGRAM_CHAT_IDS`
- Admin banners in `/plan-billing`

Idempotency is enforced via `SubscriptionLifecycleNotification.dedupeKey`.

### Immutable audit
Every lifecycle transition appends an immutable audit entry:
- category `billing`
- action `subscription.lifecycle.transition`
- payload includes `fromStatus`, `toStatus`, actor/job and timestamps

