import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateInvoiceDto {
  @ApiProperty()
  @IsString()
  type!: "A" | "B" | "C" | "M";

  @ApiProperty()
  @IsInt()
  @Min(1)
  pointOfSale!: number;

  @ApiProperty()
  @IsNumber()
  total!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  saleId?: string;
}
