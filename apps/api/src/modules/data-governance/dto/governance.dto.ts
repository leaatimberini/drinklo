import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsIn, IsInt, IsISO8601, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { GovernanceEntity } from "@erp/db";

export class PolicyItemDto {
  @ApiProperty({ enum: ["starter", "pro", "enterprise"] })
  @IsIn(["starter", "pro", "enterprise"])
  plan!: "starter" | "pro" | "enterprise";

  @ApiProperty({ enum: GovernanceEntity })
  @IsEnum(GovernanceEntity)
  entity!: GovernanceEntity;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  retentionDays!: number;
}

export class UpsertRetentionPoliciesDto {
  @ApiProperty({ type: [PolicyItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyItemDto)
  items!: PolicyItemDto[];
}

export class CreateLegalHoldDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  periodFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  periodTo?: string;

  @ApiProperty()
  @IsString()
  reason!: string;
}

export class ReleaseLegalHoldDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class GovernanceRunsQueryDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
