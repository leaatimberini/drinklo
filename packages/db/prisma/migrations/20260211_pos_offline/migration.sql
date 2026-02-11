ALTER TABLE "Sale" ADD COLUMN "clientTxnId" text;
CREATE UNIQUE INDEX "Sale_companyId_clientTxnId_key" ON "Sale"("companyId", "clientTxnId");
