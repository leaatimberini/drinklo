import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";

export class BrandingImportDto {
  @ApiProperty()
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  signature!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  apply?: boolean;
}
