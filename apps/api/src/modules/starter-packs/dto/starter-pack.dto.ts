import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class ApplyStarterPackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  catalog?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  templates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  packageId?: string;
}
