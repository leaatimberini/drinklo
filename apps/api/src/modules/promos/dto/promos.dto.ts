import { IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString } from "class-validator";
import { CouponType, LoyaltyRuleType } from "@erp/db";

export class CreateCouponDto {
  @IsString()
  code!: string;

  @IsEnum(CouponType)
  type!: CouponType;

  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  perCustomerLimit?: number;

  @IsOptional()
  @IsNumber()
  minSubtotal?: number;

  @IsOptional()
  @IsNumber()
  maxDiscount?: number;

  @IsOptional()
  @IsString()
  priceListId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}

export class CreateGiftCardDto {
  @IsString()
  code!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  issuedToEmail?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class CreateLoyaltyTierDto {
  @IsString()
  name!: string;

  @IsInt()
  minPoints!: number;

  @IsOptional()
  @IsNumber()
  multiplier?: number;
}

export class CreateLoyaltyRuleDto {
  @IsEnum(LoyaltyRuleType)
  type!: LoyaltyRuleType;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class ValidateCouponDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @IsString()
  priceListId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsObject()
  items?: Array<{ productId: string; categoryIds?: string[]; quantity: number; unitPrice: number }>;

  @IsOptional()
  @IsNumber()
  shippingCost?: number;
}
