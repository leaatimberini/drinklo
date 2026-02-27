-- Payments and webhook logs
CREATE TYPE "PaymentProvider" AS ENUM ('MERCADOPAGO');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_PROCESS', 'REJECTED', 'CANCELED');

CREATE TABLE "Payment" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId" text NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "preferenceId" text,
  "paymentId" text,
  "status" "PaymentStatus" NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "currency" text NOT NULL,
  "raw" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WebhookLog" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "provider" text NOT NULL,
  "eventId" text NOT NULL,
  "payload" jsonb NOT NULL,
  "headers" jsonb,
  "receivedAt" timestamptz NOT NULL DEFAULT now(),
  "processedAt" timestamptz,
  "status" text,
  "error" text,
  CONSTRAINT "WebhookLog_provider_eventId_key" UNIQUE ("provider", "eventId")
);

CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX "Payment_paymentId_idx" ON "Payment"("paymentId");
CREATE INDEX "WebhookLog_provider_idx" ON "WebhookLog"("provider");

