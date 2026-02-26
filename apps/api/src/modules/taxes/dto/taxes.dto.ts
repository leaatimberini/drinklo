import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

const TAX_RULE_KINDS = ["IVA", "PERCEPTION", "WITHHOLDING"] as const;
const TAX_PRICE_MODES = ["INCLUDED", "EXCLUDED"] as const;
const TAX_ROUNDING_MODES = ["HALF_UP", "UP", "DOWN"] as const;
const TAX_ROUNDING_SCOPES = ["LINE", "TOTAL"] as const;

export class UpsertTaxProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ default: "ARS" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: TAX_PRICE_MODES, default: "EXCLUDED" })
  @IsOptional()
  @IsIn(TAX_PRICE_MODES)
  ivaDefaultMode?: "INCLUDED" | "EXCLUDED";

  @ApiPropertyOptional({ enum: TAX_ROUNDING_MODES, default: "HALF_UP" })
  @IsOptional()
  @IsIn(TAX_ROUNDING_MODES)
  roundingMode?: "HALF_UP" | "UP" | "DOWN";

  @ApiPropertyOptional({ enum: TAX_ROUNDING_SCOPES, default: "TOTAL" })
  @IsOptional()
  @IsIn(TAX_ROUNDING_SCOPES)
  roundingScope?: "LINE" | "TOTAL";

  @ApiPropertyOptional({ default: 0.01 })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  roundingIncrement?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TaxRuleItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: TAX_RULE_KINDS })
  @IsIn(TAX_RULE_KINDS)
  kind!: "IVA" | "PERCEPTION" | "WITHHOLDING";

  @ApiProperty({ description: "Porcentaje como decimal. Ej 0.21 = 21%" })
  @IsNumber()
  @Min(0)
  @Max(10)
  rate!: number;

  @ApiPropertyOptional({ enum: TAX_PRICE_MODES })
  @IsOptional()
  @IsIn(TAX_PRICE_MODES)
  priceMode?: "INCLUDED" | "EXCLUDED";

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  applyToShipping?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationState?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCodePrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ReplaceTaxRulesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiProperty({ type: [TaxRuleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxRuleItemDto)
  items!: TaxRuleItemDto[];
}

export class TaxSimulationAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class TaxSimulationItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: "Precio unitario bruto/cargado en checkout" })
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class TaxSimulateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiPropertyOptional({ default: "ARS" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountTotal?: number;

  @ApiPropertyOptional({ type: TaxSimulationAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TaxSimulationAddressDto)
  address?: TaxSimulationAddressDto;

  @ApiProperty({ type: [TaxSimulationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxSimulationItemDto)
  items!: TaxSimulationItemDto[];
}

