# Academy (ES)

## Objetivo
`apps/academy` provee cursos guiados por ICP (Kiosco / Distribuidora / Bar) para acelerar activacion y operacion.

Incluye:
- cursos con modulos + quizzes
- tracking de progreso por empresa/usuario
- certificados internos `Admin Certified`
- evidencia hash + timestamp en compliance evidence
- recomendaciones desde onboarding (pasos trabados)
- dashboard en control-plane con progreso por empresa

## Modelo (control-plane)
- `AcademyProgress`
  - progreso por `instanceId + learnerKey + courseKey`
  - modulos completados, scores de quiz, porcentaje, estado
- `AcademyCertificate`
  - certificado emitido con `evidenceHash` y `evidenceSignature`
- evidencia adicional en `ComplianceEvidence` (`academy_certificate`)

## Cursos por ICP (v1)
- `kiosco-fast-start`
- `distribuidora-operaciones`
- `bar-servicio-rapido`

## Integracion con onboarding
`apps/api` agrega `academyRecommendations` en respuesta de onboarding.
La recomendacion se calcula en base a pasos pendientes/recomendados:
- `import_catalog`
- `configure_wholesale_pricelists`
- `configure_shipping`
- `configure_mercadopago`
- `test_print_scanner`
- `create_first_sale_or_order`

## Endpoints control-plane
- `GET /api/academy/catalog`
  - catalogo + progreso del learner + recomendaciones por pasos trabados
- `GET/POST /api/academy/progress`
  - track `module_complete`, `quiz_submit`, `issue_certificate`
- `GET /api/academy/admin`
  - dashboard de progreso por instancia/empresa

## App `apps/academy`
- `/` catalogo y recomendados
- `/courses/[courseKey]` reproductor simple (modulos/quizzes/certificado)
- proxy routes locales a control-plane (`/api/catalog`, `/api/progress`)

## Certificados internos
Al emitir certificado:
1. valida curso completado
2. genera payload de evidencia
3. calcula `SHA-256` (`evidenceHash`)
4. firma HMAC (`evidenceSignature`)
5. guarda certificado + `ComplianceEvidence`

## Tests
- tracking de progreso determinista
- emision de certificado y evidencia

---

# Academy (EN)

## Purpose
`apps/academy` provides ICP-based courses (Kiosk / Distributor / Bar) to improve activation and operational readiness.

It includes:
- courses with modules + quizzes
- progress tracking per company/user
- internal `Admin Certified` certificates
- hash + timestamp evidence stored in compliance evidence
- onboarding-based course recommendations for blocked steps
- control-plane progress dashboard by company

## Data model (control-plane)
- `AcademyProgress`
  - progress per `instanceId + learnerKey + courseKey`
  - completed modules, quiz scores, percentage, status
- `AcademyCertificate`
  - issued certificate with `evidenceHash` and `evidenceSignature`
- additional evidence in `ComplianceEvidence` (`academy_certificate`)

## ICP Courses (v1)
- `kiosco-fast-start`
- `distribuidora-operaciones`
- `bar-servicio-rapido`

## Onboarding integration
`apps/api` now returns `academyRecommendations` in onboarding responses.
Recommendations are derived from pending/recommended onboarding steps.

## Control-plane endpoints
- `GET /api/academy/catalog`
- `GET/POST /api/academy/progress`
- `GET /api/academy/admin`

## `apps/academy`
- `/` catalog + recommended courses
- `/courses/[courseKey]` simple player (modules/quizzes/certificate)
- local proxy routes to control-plane (`/api/catalog`, `/api/progress`)

## Internal certificates
When issuing a certificate the system validates completion, creates an evidence payload, computes a SHA-256 hash, signs it (HMAC), and persists both certificate and compliance evidence.

## Tests
- deterministic progress tracking
- certificate issuance + evidence

