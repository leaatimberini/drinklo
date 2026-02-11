ALTER TABLE "CompanySettings" ADD COLUMN "enableAfip" boolean NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN "enableMercadoLibre" boolean NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN "enableRappi" boolean NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN "enablePedidosYa" boolean NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN "enableAndreani" boolean NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN "enableOwnDelivery" boolean NOT NULL DEFAULT false;
