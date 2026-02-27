-- FX rates
CREATE TABLE "FxRate" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "currencyCode" text NOT NULL,
  "date" timestamptz NOT NULL,
  "rate" numeric(18, 6) NOT NULL,
  "source" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "FxRate_currencyCode_date_key" UNIQUE ("currencyCode", "date")
);

CREATE INDEX "FxRate_currencyCode_idx" ON "FxRate"("currencyCode");
CREATE INDEX "FxRate_date_idx" ON "FxRate"("date");

