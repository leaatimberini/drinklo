# Privacidad AR

## Exportar datos personales
Endpoint admin:
- `GET /admin/privacy/customers/:id/export?format=json|csv`

Incluye:
- Datos de cliente
- Direcciones

## Anonimización
Endpoint admin:
- `POST /admin/privacy/customers/:id/anonymize`

Acciones:
- Soft-delete del cliente y direcciones
- Reemplazo de datos personales (nombre/email/teléfono)
- Registro en `PrivacyRequest`

## Políticas de retención
Configurable por empresa:
- `retentionLogsDays`
- `retentionOrdersDays`
- `retentionMarketingDays`

Endpoints:
- `GET /admin/privacy/policies`
- `PATCH /admin/privacy/policies`

## Auditoría
`PrivacyRequest` registra acciones de anonimización con usuario y timestamp.
