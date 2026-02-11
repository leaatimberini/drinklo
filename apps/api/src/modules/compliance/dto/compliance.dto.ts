import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateComplianceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ageGateMode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  termsUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  privacyUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cookiesUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  marketingConsentRequired?: boolean;
}

export class ConsentDto {
  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty()
  @IsBoolean()
  accepted!: boolean;
}
