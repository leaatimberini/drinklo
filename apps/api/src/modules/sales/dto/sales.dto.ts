import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class SaleItemDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateSaleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clientTxnId?: string;

  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @ApiProperty({ default: 0 })
  @IsNumber()
  discount!: number;

  @ApiProperty({ enum: ["cash", "card", "transfer"] })
  @IsIn(["cash", "card", "transfer"])
  paymentMethod!: "cash" | "card" | "transfer";

  @ApiProperty({ default: 0 })
  @IsNumber()
  paidAmount!: number;
}

export class OfflineSaleDraftDto extends CreateSaleDto {
  @ApiProperty()
  @IsString()
  clientTxnId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  localCreatedAt?: string;
}

export class OfflineSyncDto {
  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineSaleDraftDto)
  drafts!: OfflineSaleDraftDto[];
}

export class SaleSearchDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  q?: string;
}
