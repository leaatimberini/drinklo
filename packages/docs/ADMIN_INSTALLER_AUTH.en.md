# Admin Installer + Auth (EN)

## Goal
Replace JWT manual paste flow in Admin with a real backoffice flow:
- one-shot installer (`/install`)
- email/password login (`/login`)
- persisted UI session
- RBAC reflected in settings/themes actions

## User flow
1. `GET /instance/status`
2. If `initialized=false` -> redirect to `/install`
3. `POST /installer/bootstrap` creates company + admin + settings + roles/permissions
4. redirect to `/login`
5. `POST /auth/login` returns `accessToken`
6. UI persists session and validates with `GET /auth/me`
7. authenticated user lands on `/`

## Endpoints
- `GET /instance/status` -> `{ initialized: boolean }`
- `POST /installer/bootstrap`
- `POST /auth/login`
- `GET /auth/me` (Bearer)
- `POST /auth/refresh` (Bearer)
- `POST /auth/logout`
- `PUT /settings/themes` (Bearer + `settings:write`)
- Legacy compatibility:
  - `GET /setup/status`
  - `POST /setup/initialize`
  - `PATCH /themes`

## Environment variables
- API:
  - `JWT_SECRET`
  - `CORS_ORIGINS`
- Admin:
  - `NEXT_PUBLIC_API_URL`
  - `ADMIN_DEVTOOLS=1` to enable `/dev/tools` (optional)

## Local run
1. `pnpm bootstrap`
2. In another terminal: `pnpm -w dev`
3. Open `http://localhost:3002`

## Validation (curl + UI)
1. Instance status:
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
4. In Admin:
  - open `/login`
  - sign in
  - open `/` and save themes with normal auth (no manual JWT input)

## Risks and mitigations
- Risk: client-side Bearer token exposure (localStorage).
  - Current mitigation: permission scopes + JWT guard + protected routes.
  - Recommended next step: move to httpOnly cookies + rotating refresh tokens.
- Risk: CORS misconfiguration in real environments.
  - Mitigation: strict `CORS_ORIGINS` per environment.
- Risk: repeated bootstrap attempts.
  - Mitigation: `POST /installer/bootstrap` returns `409` once initialized.

## Progress Update (EN)
- Implemented:
  - `instance/installer/auth me-refresh-logout` endpoints
  - `PUT /settings/themes` with RBAC `settings:write`
  - Admin `/install`, `/login`, `AuthProvider`, `AuthGate`, and home without manual JWT field
  - optional devtool `/dev/tools` behind flag
- Pending:
  - migrate session to httpOnly cookies (hardening)
  - standardize legacy screens that still rely on manual token inputs
- Validation run:
  - `pnpm -C apps/api lint` ✅
  - `pnpm -C apps/admin lint` ✅ (pre-existing hook warnings)
  - `pnpm -C apps/api test -- src/modules/setup/setup.service.spec.ts src/modules/auth/auth.service.spec.ts src/modules/themes/settings-themes.controller.spec.ts` ✅
  - `pnpm -C apps/api build` ✅
  - `pnpm -C apps/admin build` ✅
  - `pnpm -w test` ❌ due pre-existing `apps/control-plane` Prisma EPERM DLL rename issue on Windows
