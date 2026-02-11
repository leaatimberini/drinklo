import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class ReconciliationQueryDto {
  @ApiPropertyOptional({ description: "ISO date (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: "timezone, e.g. America/Argentina/Buenos_Aires" })
  @IsOptional()
  @IsString()
  tz?: string;
}
