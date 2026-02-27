ALTER TABLE IF EXISTS "Sale" ADD COLUMN IF NOT EXISTS "clientTxnId" text;

DO $$
BEGIN
  IF to_regclass('"Sale"') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "Sale_companyId_clientTxnId_key" ON "Sale"("companyId", "clientTxnId")';
  END IF;
END
$$;

