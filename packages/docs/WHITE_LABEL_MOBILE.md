# White-label Mobile / Mobile White-label

## ES

### Objetivo
Soportar branding por empresa en `apps/mobile` y operar OTA updates por canal (`stable`/`beta`) alineados con rollout del control-plane.

### Qué incluye (v1)
- **Branding config remoto** para mobile:
  - nombre app
  - logo/assets URLs
  - theme tokens (colores/radios)
  - channel OTA + runtimeVersion
- **Fallback local + cache**
  - config default embebida
  - cache en `AsyncStorage`
- **Panel control-plane** `/mobile-white-label`
  - crear/editar `MobileBrandProfile`
  - generar `MobileBuildProfile` (EAS-like)
  - publicar `MobileOtaUpdate`

### Modelos (control-plane DB)
- `MobileBrandProfile`
- `MobileBuildProfile`
- `MobileOtaUpdate`

### Endpoints control-plane
- `GET/POST /api/mobile/white-label`
- `GET /api/mobile/white-label/config?instanceId=...&channel=stable|beta`
- `GET/POST /api/mobile/white-label/build-profile`
- `GET/POST /api/mobile/white-label/updates`

### OTA (EAS Update o equivalente)
- Canalización lógica:
  - `requestedChannel` > `installation.releaseChannel` > `defaultChannel`
- Por empresa:
  - `otaStableChannel`
  - `otaBetaChannel`
- Publicación OTA guarda:
  - `channel` (stable/beta lógico)
  - `rolloutChannel` (canal de rollout de la instancia)
  - `runtimeVersion`
  - `targetVersion`

### Mobile app
Archivos clave:
- `apps/mobile/src/branding/whiteLabel.ts`
- `apps/mobile/src/services/mobileBranding.ts`
- `apps/mobile/App.tsx`

Comportamiento:
- descarga config remoto (si `EXPO_PUBLIC_MOBILE_BRANDING_CONFIG_URL` está definido)
- usa cache si existe
- aplica theme tokens al UI y muestra metadata OTA

### Tests
- Theme application: `apps/mobile/src/branding/__tests__/whiteLabel.test.ts`
- Config download/cache: `apps/mobile/src/services/__tests__/mobileBranding.test.ts`
- OTA channelization/build profile: `apps/control-plane/app/lib/mobile-white-label.test.ts`

## EN

### Goal
Support company-specific branding in `apps/mobile` and OTA updates via `stable`/`beta` channels aligned with control-plane rollout.

### Included (v1)
- Remote mobile branding config:
  - app name
  - logo/assets URLs
  - theme tokens
  - OTA channel + runtimeVersion
- Local fallback + AsyncStorage cache
- Control-plane panel `/mobile-white-label`
  - brand profile management
  - build profile generation (EAS-like)
  - OTA publish records

### OTA channel logic
Priority:
1. requested channel
2. installation rollout channel
3. company default channel

### Notes
- This implementation models OTA publication and channelization in control-plane.
- Real EAS publish execution can be wired later (CLI/CI job) using the generated build/update payloads.

