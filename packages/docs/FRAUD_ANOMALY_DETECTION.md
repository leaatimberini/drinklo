# Fraud & Anomaly Detection (ES/EN)

## ES

### Alcance
Se implemento un motor de reglas + scoring para deteccion de fraude y anomalias en checkout/webhooks.

### Reglas incluidas
- `AMOUNT_UNUSUAL`: monto de orden inusual contra promedio 30d.
- `ORDER_FREQUENCY`: frecuencia alta por email (1h/24h).
- `IP_GEO_RISK`: mismatch pais envio vs geo header o burst por IP.
- `MULTIPLE_PAYMENT_FAILURES`: fallos repetidos de pago en 24h.
- `WEBHOOK_PATTERN`: picos anormales de errores/duplicados de webhook.

### Scoring y acciones
- Score por suma de pesos de reglas disparadas.
- Niveles:
- `0-24`: `NONE`
- `25-49`: `LOW` => `NOTIFY_ONLY`
- `50-79`: `MEDIUM` => `REQUIRE_VERIFICATION`
- `>=80`: `HIGH` => `HOLD_ORDER`

### Flujo operativo
1. Al crear orden (`POST /checkout/orders`) se ejecuta scoring.
2. Se guarda `FraudAssessment` con explicabilidad (`reasons`, `reasonSummary`, `context`).
3. Si hay riesgo:
- se emiten eventos canonical `FraudScored` y `FraudAlertRaised`.
- se notifican webhooks opcionales (control-plane y bot).
4. Si accion es `HOLD_ORDER`:
- se agrega evento de estado de orden con marca `FRAUD_HOLD`.
- se marca metadata de orden (`shippingMeta.fraudHold=true`).

### Cola de revision (dashboard admin)
- UI: `apps/admin/app/fraud/page.tsx`
- Endpoint cola:
- `GET /admin/fraud/queue?status=OPEN&limit=50`
- Endpoint review:
- `POST /admin/fraud/review/:id` con `status=RESOLVED|DISMISSED`

### Configuracion de reglas
- `GET /admin/fraud/rules`
- `PATCH /admin/fraud/rules/:code`

Campos editables:
- `enabled`
- `weight`
- `threshold` (si aplica)

### Integracion Event Model
Nuevos eventos en `packages/shared/src/event-model.ts`:
- `FraudScored`
- `FraudAlertRaised`
- `FraudReviewUpdated`

### Integracion Control-Plane/Bot (alertas)
Variables opcionales API:
- `CONTROL_PLANE_ALERT_WEBHOOK_URL`
- `CONTROL_PLANE_ALERT_WEBHOOK_TOKEN`
- `BOT_ALERT_WEBHOOK_URL`

Payload base enviado:
- `type`
- `companyId`
- `assessmentId`
- `orderId` (si aplica)
- `score`, `riskLevel`, `action`, `reasonSummary`

### Modelos DB
- `FraudRule`
- `FraudAssessment`

Enums:
- `FraudAction`
- `FraudAssessmentStatus`

### Tests
- `apps/api/src/modules/fraud/scoring.spec.ts`
- casos deterministas con fixtures:
- escenario high-risk
- escenario limpio
- deshabilitacion de regla por peso

## EN

### Scope
A rule engine + scoring pipeline was implemented for fraud/anomaly detection on checkout and webhook activity.

### Included rules
- `AMOUNT_UNUSUAL`
- `ORDER_FREQUENCY`
- `IP_GEO_RISK`
- `MULTIPLE_PAYMENT_FAILURES`
- `WEBHOOK_PATTERN`

### Scoring and actions
- Score = sum of triggered rule weights.
- Levels:
- `0-24`: `NONE`
- `25-49`: `LOW` => `NOTIFY_ONLY`
- `50-79`: `MEDIUM` => `REQUIRE_VERIFICATION`
- `>=80`: `HIGH` => `HOLD_ORDER`

### Runtime flow
1. Checkout order creation triggers fraud scoring.
2. A `FraudAssessment` row is persisted with explainability details.
3. If risky:
- canonical events are emitted (`FraudScored`, `FraudAlertRaised`)
- optional control-plane/bot webhooks are notified.
4. For `HOLD_ORDER`:
- order status event includes `FRAUD_HOLD`
- order metadata is flagged (`shippingMeta.fraudHold=true`).

### Admin review queue
- UI: `apps/admin/app/fraud/page.tsx`
- Queue endpoint: `GET /admin/fraud/queue`
- Review endpoint: `POST /admin/fraud/review/:id`

### Rule management
- `GET /admin/fraud/rules`
- `PATCH /admin/fraud/rules/:code`

Editable fields:
- `enabled`
- `weight`
- `threshold`

### Event model integration
New canonical event names:
- `FraudScored`
- `FraudAlertRaised`
- `FraudReviewUpdated`

### Control-plane/bot alerts
Optional API env vars:
- `CONTROL_PLANE_ALERT_WEBHOOK_URL`
- `CONTROL_PLANE_ALERT_WEBHOOK_TOKEN`
- `BOT_ALERT_WEBHOOK_URL`

### DB models
- `FraudRule`
- `FraudAssessment`

Enums:
- `FraudAction`
- `FraudAssessmentStatus`

### Tests
- deterministic fixture coverage in `apps/api/src/modules/fraud/scoring.spec.ts`
