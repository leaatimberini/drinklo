import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateSupplierDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;
}

export class CreatePurchaseOrderItemDto {
  @ApiProperty()
  @IsString()
  variantId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantityOrdered!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsString()
  supplierId!: string;

  @ApiProperty({ type: [CreatePurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items!: CreatePurchaseOrderItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceiveGoodsItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  purchaseOrderItemId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantityReceived!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lotCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  manufacturingDate?: string;
}

export class ReceiveGoodsDto {
  @ApiProperty({ type: [ReceiveGoodsItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveGoodsItemDto)
  items!: ReceiveGoodsItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSupplierInvoiceDto {
  @ApiProperty()
  @IsString()
  supplierId!: string;

  @ApiProperty()
  @IsString()
  number!: string;

  @ApiProperty()
  @IsDateString()
  issuedAt!: string;

  @ApiProperty()
  @IsDateString()
  dueAt!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  subtotal!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  goodsReceiptId?: string;
}
