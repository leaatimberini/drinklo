import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

export class ForecastQueryDto {
  @ApiPropertyOptional({ enum: ["7", "14", "30"], default: "14" })
  @IsOptional()
  @IsString()
  @IsIn(["7", "14", "30"])
  horizonDays?: "7" | "14" | "30";
}
