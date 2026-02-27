ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "enableAfip" boolean NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "enableMercadoLibre" boolean NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "enableRappi" boolean NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "enablePedidosYa" boolean NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "enableAndreani" boolean NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "enableOwnDelivery" boolean NOT NULL DEFAULT false;

