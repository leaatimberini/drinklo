# Outbound Sequences (ES/EN)

## ES

### Objetivo
Motor de secuencias outbound para leads del proveedor (control-plane):
- plantillas email con variables
- pasos con delays
- asignacion por ICP
- tracking (send/open/click)
- compliance (opt-out)

### Componentes
- `OutboundSequence`: plantilla/version activa
- `OutboundSequenceStep`: pasos ordenados con `delayDays`
- `OutboundSequenceEnrollment`: lead/deal asignado a una secuencia
- `OutboundSequenceEvent`: auditoria y tracking (`SENT`, `OPEN`, `CLICK`, `UNSUBSCRIBE`, etc.)
- `OutboundSequenceOptOut`: lista de exclusiones por email

### Flujo
1. Crear/editar secuencia desde Control-plane (`/outbound-sequences`)
2. Asignar por ICP (`kiosco`, `distribuidora`, etc.)
3. Ejecutar dispatch (manual o job futuro)
4. Registrar tracking por pixel/click
5. Respetar opt-out en envios futuros

### Endpoints
- `GET /api/outbound-sequences`
- `POST /api/outbound-sequences`
  - `upsertSequence`
  - `enrollByIcp`
  - `dispatchDue`
  - `optOut`
- `GET /api/outbound-sequences/track/open?t=...`
- `GET /api/outbound-sequences/track/click?t=...&u=...`
- `GET|POST /api/outbound-sequences/unsubscribe`

### Compliance / Logs
- Todo envio y evento de tracking se guarda en `OutboundSequenceEvent`
- Opt-out bloquea nuevas entregas y mueve enrollments a `OPTED_OUT`
- Se genera evidencia de batch en `ComplianceEvidence` (`outbound_sequences.dispatch_batch`)

### Limitaciones (v1)
- Provider de email es mock (`mock-email`)
- Opens/clicks dependen de carga de pixel/click tracking
- No incluye scheduler cron dedicado (dispatch manual via API/UI)

## EN

### Goal
Provider-side outbound sequence engine for lead nurturing in control-plane:
- email templates + variables
- multi-step sequences with delays
- ICP-based assignment
- send/open/click tracking
- compliance-safe opt-out

### Data Model
- `OutboundSequence`: sequence template
- `OutboundSequenceStep`: ordered steps with `delayDays`
- `OutboundSequenceEnrollment`: assigned lead/deal
- `OutboundSequenceEvent`: send/tracking/compliance events
- `OutboundSequenceOptOut`: suppression list by email

### Flow
1. Create/update sequence in `/outbound-sequences`
2. Assign to leads by ICP
3. Dispatch due steps (manual now, schedulable later)
4. Track opens/clicks through public endpoints
5. Respect opt-out for all future sends

### API
- `GET /api/outbound-sequences`
- `POST /api/outbound-sequences`
- `GET /api/outbound-sequences/track/open`
- `GET /api/outbound-sequences/track/click`
- `GET|POST /api/outbound-sequences/unsubscribe`

### Compliance / Logging
- Every send/tracking action is logged in `OutboundSequenceEvent`
- Opt-out blocks delivery and updates enrollments to `OPTED_OUT`
- Batch dispatch evidence stored in `ComplianceEvidence`

### v1 Notes
- Email delivery provider is mocked
- Tracking availability depends on client opening pixel / clicking tracked links
- No dedicated cron worker yet (manual dispatch supported)

