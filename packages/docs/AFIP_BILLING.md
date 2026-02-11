# ARCA (ex AFIP) Billing (Optional)

## Overview
Billing is optional and controlled by `CompanySettings.billingMode`:
- `NO_FISCAL`: skip ARCA (ex AFIP)
- `AFIP`: enable WSAA + WSFEv1 flow (ARCA services)

## Data Model
- `Invoice`: stores CAE, CAE due date, invoice number, totals.
- `AfipLog`: request/response + errors for audit and retries (ARCA).

## Environment
Configure cert/key paths in `.env` (do not commit secrets):
```
AFIP_CERT_PATH=C:/secrets/afip/cert.crt
AFIP_KEY_PATH=C:/secrets/afip/private.key
```

## WSAA (ARCA)
- Build TRA (XML) and sign with X.509.
- Call WSAA endpoint based on environment (HOMO/PROD).
- Receive `token` + `sign`.

## WSFEv1 (ARCA)
- Use `token/sign` to request CAE for A/B/C/M.
- Store CAE, CAE due date and invoice number in `Invoice`.

## Environments
- `CompanySettings.afipEnvironment`: `HOMO` (HomologaciÃ³n) or `PROD` (ProducciÃ³n).
- `CompanySettings.afipCertIssuer`: entidad emisora del certificado (ARCA AC).
- Switch endpoints based on environment.

## Retry + Logs
- Retries are built into `BillingService.withRetry()`.
- Each attempt is recorded in `AfipLog` with status and error.

## Endpoints
- `POST /billing/invoices` creates invoice (if billing enabled).

## Certificate Handling
- Store certificates outside the repo (e.g. `C:/secrets/afip/`).
- Ensure file permissions restrict access.
- Do not commit certs or private keys.

## Files
- Billing service: `apps/api/src/modules/billing/billing.service.ts`
- WSAA client: `apps/api/src/modules/billing/afip/wsaa.client.ts`
- WSFE client: `apps/api/src/modules/billing/afip/wsfe.client.ts`

