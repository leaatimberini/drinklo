import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

export class ImportRequestDto {
  @ApiProperty({ description: "products | variants | prices | stock | customers" })
  @IsString()
  type!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;
}

export class ExportRequestDto {
  @ApiProperty({ description: "products | variants | prices | stock | customers" })
  @IsString()
  type!: string;
}
