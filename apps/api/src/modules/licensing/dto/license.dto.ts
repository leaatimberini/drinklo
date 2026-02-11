import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDateString, IsOptional, IsString } from "class-validator";

export class LicenseGenerateDto {
  @ApiProperty()
  @IsString()
  plan!: string;

  @ApiProperty({ description: "ISO date string" })
  @IsDateString()
  expiresAt!: string;

  @ApiProperty({ isArray: true, required: false })
  @IsOptional()
  @IsArray()
  features?: string[];
}

export class LicenseApplyDto {
  @ApiProperty()
  @IsString()
  licenseKey!: string;
}
