# Admin Installer + Auth (ES)

## Objetivo
Reemplazar el flujo de Admin basado en pegar JWT por un flujo real:
- instalación one-shot (`/install`)
- login email/password (`/login`)
- sesión persistida en UI
- RBAC aplicado en acciones de settings/themes

## Flujo de usuario
1. `GET /instance/status`
2. Si `initialized=false` -> UI redirige a `/install`
3. `POST /installer/bootstrap` crea company + admin + settings + roles/permisos
4. UI redirige a `/login`
5. `POST /auth/login` devuelve `accessToken`
6. UI guarda sesión y valida con `GET /auth/me`
7. Usuario autenticado entra al backoffice `/`

## Endpoints
- `GET /instance/status` -> `{ initialized: boolean }`
- `POST /installer/bootstrap`
- `POST /auth/login`
- `GET /auth/me` (Bearer)
- `POST /auth/refresh` (Bearer)
- `POST /auth/logout`
- `PUT /settings/themes` (Bearer + `settings:write`)
- Compatibilidad legacy:
  - `GET /setup/status`
  - `POST /setup/initialize`
  - `PATCH /themes`

## Variables de entorno
- API:
  - `JWT_SECRET`
  - `CORS_ORIGINS`
- Admin:
  - `NEXT_PUBLIC_API_URL`
  - `ADMIN_DEVTOOLS=1` para habilitar `/dev/tools` (opcional)

## Cómo correr local
1. `pnpm bootstrap`
2. En otra terminal: `pnpm -w dev`
3. Abrir `http://localhost:3002`

## Cómo probar (curl + UI)
1. Estado instancia:
```bash
curl http://localhost:3001/instance/status
```
2. Bootstrap:
```bash
curl -X POST http://localhost:3001/installer/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Acme","adminEmail":"admin@acme.local","adminPassword":"admin123","themeAdmin":"A","themeStorefront":"B"}'
```
3. Login:
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.local","password":"admin123"}'
```
4. En Admin:
  - entrar a `/login`
  - autenticar
  - ir a `/` y guardar themes sin pegar JWT manual

## Riesgos y mitigaciones
- Riesgo: token expuesto en cliente (Bearer localStorage).
  - Mitigación actual: scope por permisos + guard JWT + rutas protegidas.
  - Próximo paso recomendado: migrar a cookies httpOnly + refresh token rotativo.
- Riesgo: CORS mal configurado en entornos reales.
  - Mitigación: usar `CORS_ORIGINS` estricto por ambiente.
- Riesgo: bootstrap repetido.
  - Mitigación: `POST /installer/bootstrap` devuelve `409` cuando ya está inicializado.

## Progress Update (ES)
- Implementado:
  - endpoints `instance/installer/auth me-refresh-logout`
  - `PUT /settings/themes` con RBAC `settings:write`
  - UI `/install`, `/login`, `AuthProvider`, `AuthGate`, home sin input JWT manual
  - devtool opcional `/dev/tools` detrás de flag
- Pendiente:
  - migrar sesión a cookie httpOnly (hardening)
  - estandarizar consumo de sesión en todas las pantallas legacy que aún usan token manual
- Validación ejecutada:
  - `pnpm -C apps/api lint` ✅
  - `pnpm -C apps/admin lint` ✅ (warnings preexistentes de hooks)
  - `pnpm -C apps/api test -- src/modules/setup/setup.service.spec.ts src/modules/auth/auth.service.spec.ts src/modules/themes/settings-themes.controller.spec.ts` ✅
  - `pnpm -C apps/api build` ✅
  - `pnpm -C apps/admin build` ✅
  - `pnpm -w test` ❌ por problema preexistente en `apps/control-plane` (Prisma EPERM al renombrar DLL en Windows)
