# Security Pipeline

Pipeline de seguridad integrada en CI/CD con análisis estático, dependencias, secretos, DAST y escaneo de imágenes.

## Componentes

- **CodeQL**: análisis estático en `push`, `PR` y schedule.
- **Dependency Review**: bloquea dependencias riesgosas en PR.
- **Secret scanning**: `gitleaks` en CI y release.
- **Trivy (images)**: escaneo de imágenes Docker con severidad CRITICAL.
- **DAST**: Playwright sobre staging con tests básicos.
- **Policy gate**: release bloqueado si:
  - CVEs críticas sin excepción (Trivy exit-code).
  - Secretos detectados (gitleaks).
  - SBOM faltante.

## Workflows

- `.github/workflows/codeql.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/ci.yml` (gitleaks + trivy)
- `.github/workflows/release.yml` (policy gate + trivy + SBOM)
- `.github/workflows/dast.yml`

## Exceptions de CVE

Usar `.trivyignore` con IDs de CVE aprobadas.

## Reporte consolidado (control-plane)

Se envía un reporte JSON a:

`POST /api/security-report`

Variables requeridas:
- `CONTROL_PLANE_URL`
- `CONTROL_PLANE_SECURITY_TOKEN`

El reporte se muestra en la portada del control-plane.

## DAST staging

Requiere secrets:
- `DAST_API_URL`
- `DAST_STOREFRONT_URL`

Ejecuta `tests/e2e/dast.spec.ts`.
