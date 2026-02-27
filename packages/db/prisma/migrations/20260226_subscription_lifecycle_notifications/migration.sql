CREATE TYPE "SubscriptionLifecycleNotificationChannel" AS ENUM ('EMAIL', 'TELEGRAM', 'ADMIN_BANNER');
CREATE TYPE "SubscriptionLifecycleNotificationStatus" AS ENUM ('SENT', 'SKIPPED', 'FAILED');

CREATE TABLE "SubscriptionLifecycleNotification" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "channel" "SubscriptionLifecycleNotificationChannel" NOT NULL,
  "kind" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" "SubscriptionLifecycleNotificationStatus" NOT NULL DEFAULT 'SENT',
  "recipient" TEXT,
  "payload" JSONB,
  "sentAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionLifecycleNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionLifecycleNotification_dedupeKey_key" ON "SubscriptionLifecycleNotification"("dedupeKey");
CREATE INDEX "SubscriptionLifecycleNotification_companyId_createdAt_idx" ON "SubscriptionLifecycleNotification"("companyId", "createdAt");
CREATE INDEX "SubscriptionLifecycleNotification_subscriptionId_kind_idx" ON "SubscriptionLifecycleNotification"("subscriptionId", "kind");
CREATE INDEX "SubscriptionLifecycleNotification_channel_status_idx" ON "SubscriptionLifecycleNotification"("channel", "status");

ALTER TABLE "SubscriptionLifecycleNotification" ADD CONSTRAINT "SubscriptionLifecycleNotification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionLifecycleNotification" ADD CONSTRAINT "SubscriptionLifecycleNotification_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

