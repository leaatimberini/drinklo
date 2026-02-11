# ARCA (ex AFIP)

## Contexto
La Agencia de Recaudacion y Control Aduanero (ARCA) reemplaza a la ex AFIP. ARCA asume la continuidad de funciones y servicios fiscales, por lo que los Web Services (WSAA/WSFEv1) continuan operando bajo la nueva denominacion institucional.

## Compatibilidad tecnica
Este sistema mantiene compatibilidad con:
- WSAA (autenticacion)
- WSFEv1 (facturacion electronica)

Los endpoints y flujos siguen el estandar publicado para los webservices de Factura Electronica.

## Configuracion fiscal
En `CompanySettings` se separa:
- `afipCertIssuer`: entidad emisora del certificado X.509 (ARCA AC)
- `afipEnvironment`: `HOMO` (Homologacion) o `PROD` (Produccion)

## Fuentes oficiales
- Decreto 953/2024: creacion de ARCA y disolucion de AFIP.
- Documentacion oficial de WSFEv1 (Factura Electronica) en ARCA.
