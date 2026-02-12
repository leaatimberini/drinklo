import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class FraudQueueQueryDto {
  @ApiPropertyOptional({ enum: ["OPEN", "RESOLVED", "DISMISSED"], default: "OPEN" })
  @IsOptional()
  @IsIn(["OPEN", "RESOLVED", "DISMISSED"])
  status?: "OPEN" | "RESOLVED" | "DISMISSED";

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class UpdateFraudRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  weight?: number;

  @ApiPropertyOptional({ description: "Optional numeric threshold for simple rules" })
  @IsOptional()
  @Type(() => Number)
  threshold?: number;
}

export class ReviewFraudAssessmentDto {
  @ApiProperty({ enum: ["RESOLVED", "DISMISSED"] })
  @IsIn(["RESOLVED", "DISMISSED"])
  status!: "RESOLVED" | "DISMISSED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class EvaluateOrderFraudDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  geoCountry?: string;
}
