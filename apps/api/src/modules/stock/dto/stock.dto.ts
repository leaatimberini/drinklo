import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateStockLocationDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class CreateStockItemDto {
  @ApiProperty()
  @IsString()
  variantId!: string;

  @ApiProperty()
  @IsString()
  locationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  quantity!: number;
}

export class UpdateStockItemDto {
  @ApiProperty()
  @IsInt()
  quantity!: number;
}

export class ReceiveStockDto {
  @ApiProperty()
  @IsString()
  variantId!: string;

  @ApiProperty()
  @IsString()
  locationId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
