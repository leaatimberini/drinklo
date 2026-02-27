CREATE TYPE "CouponType" AS ENUM ('PERCENT','FIXED','FREE_SHIPPING');
CREATE TYPE "GiftCardStatus" AS ENUM ('ACTIVE','REDEEMED','EXPIRED','VOID');
CREATE TYPE "GiftCardTransactionType" AS ENUM ('ISSUE','REDEEM','ADJUST');
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN','REDEEM','ADJUST');
CREATE TYPE "LoyaltyRuleType" AS ENUM ('EARN_RATE','BONUS_PRODUCT','BONUS_CATEGORY');

CREATE TABLE "Coupon" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "code" text NOT NULL,
  "type" "CouponType" NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "currency" text NOT NULL,
  "startsAt" timestamp(3),
  "endsAt" timestamp(3),
  "usageLimit" integer,
  "usageCount" integer NOT NULL DEFAULT 0,
  "perCustomerLimit" integer,
  "minSubtotal" numeric(10,2),
  "maxDiscount" numeric(10,2),
  "priceListId" text,
  "categoryId" text,
  "customerId" text,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CouponRedemption" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "couponId" text NOT NULL,
  "orderId" text,
  "customerId" text,
  "email" text,
  "amount" numeric(10,2) NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GiftCard" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "code" text NOT NULL,
  "initialAmount" numeric(10,2) NOT NULL,
  "balance" numeric(10,2) NOT NULL,
  "currency" text NOT NULL,
  "issuedToEmail" text,
  "expiresAt" timestamp(3),
  "status" "GiftCardStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GiftCardTransaction" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "giftCardId" text NOT NULL,
  "type" "GiftCardTransactionType" NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "orderId" text,
  "note" text,
  "createdById" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftCardTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyTier" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "minPoints" integer NOT NULL,
  "multiplier" double precision NOT NULL DEFAULT 1,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyRule" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "type" "LoyaltyRuleType" NOT NULL,
  "config" jsonb NOT NULL,
  "productId" text,
  "categoryId" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "LoyaltyRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyAccount" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "customerId" text NOT NULL,
  "tierId" text,
  "pointsBalance" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyTransaction" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "accountId" text NOT NULL,
  "type" "LoyaltyTransactionType" NOT NULL,
  "points" integer NOT NULL,
  "orderId" text,
  "note" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "subtotal" numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "discountTotal" numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "couponId" text;
ALTER TABLE "Order" ADD COLUMN "couponCode" text;
ALTER TABLE "Order" ADD COLUMN "giftCardId" text;
ALTER TABLE "Order" ADD COLUMN "giftCardAmount" numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "loyaltyPointsUsed" integer NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "loyaltyPointsEarned" integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Coupon_companyId_code_key" ON "Coupon"("companyId", "code");
CREATE INDEX "Coupon_companyId_idx" ON "Coupon"("companyId");
CREATE INDEX "Coupon_type_idx" ON "Coupon"("type");
CREATE INDEX "Coupon_active_idx" ON "Coupon"("active");
CREATE INDEX "Coupon_startsAt_idx" ON "Coupon"("startsAt");
CREATE INDEX "Coupon_endsAt_idx" ON "Coupon"("endsAt");
CREATE INDEX "Coupon_priceListId_idx" ON "Coupon"("priceListId");
CREATE INDEX "Coupon_categoryId_idx" ON "Coupon"("categoryId");
CREATE INDEX "Coupon_customerId_idx" ON "Coupon"("customerId");

CREATE INDEX "CouponRedemption_companyId_idx" ON "CouponRedemption"("companyId");
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX "CouponRedemption_orderId_idx" ON "CouponRedemption"("orderId");
CREATE INDEX "CouponRedemption_customerId_idx" ON "CouponRedemption"("customerId");
CREATE INDEX "CouponRedemption_createdAt_idx" ON "CouponRedemption"("createdAt");

CREATE UNIQUE INDEX "GiftCard_companyId_code_key" ON "GiftCard"("companyId", "code");
CREATE INDEX "GiftCard_companyId_idx" ON "GiftCard"("companyId");
CREATE INDEX "GiftCard_status_idx" ON "GiftCard"("status");
CREATE INDEX "GiftCard_expiresAt_idx" ON "GiftCard"("expiresAt");

CREATE INDEX "GiftCardTransaction_companyId_idx" ON "GiftCardTransaction"("companyId");
CREATE INDEX "GiftCardTransaction_giftCardId_idx" ON "GiftCardTransaction"("giftCardId");
CREATE INDEX "GiftCardTransaction_type_idx" ON "GiftCardTransaction"("type");
CREATE INDEX "GiftCardTransaction_orderId_idx" ON "GiftCardTransaction"("orderId");
CREATE INDEX "GiftCardTransaction_createdAt_idx" ON "GiftCardTransaction"("createdAt");

CREATE UNIQUE INDEX "LoyaltyTier_companyId_name_key" ON "LoyaltyTier"("companyId", "name");
CREATE INDEX "LoyaltyTier_companyId_idx" ON "LoyaltyTier"("companyId");
CREATE INDEX "LoyaltyTier_minPoints_idx" ON "LoyaltyTier"("minPoints");

CREATE INDEX "LoyaltyRule_companyId_idx" ON "LoyaltyRule"("companyId");
CREATE INDEX "LoyaltyRule_type_idx" ON "LoyaltyRule"("type");
CREATE INDEX "LoyaltyRule_productId_idx" ON "LoyaltyRule"("productId");
CREATE INDEX "LoyaltyRule_categoryId_idx" ON "LoyaltyRule"("categoryId");

CREATE UNIQUE INDEX "LoyaltyAccount_companyId_customerId_key" ON "LoyaltyAccount"("companyId", "customerId");
CREATE INDEX "LoyaltyAccount_companyId_idx" ON "LoyaltyAccount"("companyId");
CREATE INDEX "LoyaltyAccount_customerId_idx" ON "LoyaltyAccount"("customerId");
CREATE INDEX "LoyaltyAccount_tierId_idx" ON "LoyaltyAccount"("tierId");

CREATE INDEX "LoyaltyTransaction_companyId_idx" ON "LoyaltyTransaction"("companyId");
CREATE INDEX "LoyaltyTransaction_accountId_idx" ON "LoyaltyTransaction"("accountId");
CREATE INDEX "LoyaltyTransaction_type_idx" ON "LoyaltyTransaction"("type");
CREATE INDEX "LoyaltyTransaction_orderId_idx" ON "LoyaltyTransaction"("orderId");
CREATE INDEX "LoyaltyTransaction_createdAt_idx" ON "LoyaltyTransaction"("createdAt");

CREATE INDEX "Order_couponId_idx" ON "Order"("couponId");
CREATE INDEX "Order_giftCardId_idx" ON "Order"("giftCardId");

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LoyaltyTier" ADD CONSTRAINT "LoyaltyTier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoyaltyRule" ADD CONSTRAINT "LoyaltyRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyRule" ADD CONSTRAINT "LoyaltyRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoyaltyRule" ADD CONSTRAINT "LoyaltyRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "LoyaltyTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

