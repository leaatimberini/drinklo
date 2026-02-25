ALTER TABLE "WebVitalSample" ADD COLUMN "shardKey" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FeatureUsageSample" ADD COLUMN "shardKey" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IntegrationBuilderReport" ADD COLUMN "shardKey" INTEGER NOT NULL DEFAULT 0;

UPDATE "WebVitalSample"
SET "shardKey" = mod(abs(hashtext("instanceId"))::bigint, 64)::int
WHERE "instanceId" IS NOT NULL;

UPDATE "FeatureUsageSample"
SET "shardKey" = mod(abs(hashtext("instanceId"))::bigint, 64)::int
WHERE "instanceId" IS NOT NULL;

UPDATE "IntegrationBuilderReport"
SET "shardKey" = mod(abs(hashtext("instanceId"))::bigint, 64)::int
WHERE "instanceId" IS NOT NULL;

CREATE INDEX "WebVitalSample_shardKey_capturedAt_idx" ON "WebVitalSample"("shardKey", "capturedAt");
CREATE INDEX "FeatureUsageSample_shardKey_capturedAt_idx" ON "FeatureUsageSample"("shardKey", "capturedAt");
CREATE INDEX "IntegrationBuilderReport_shardKey_capturedAt_idx" ON "IntegrationBuilderReport"("shardKey", "capturedAt");

