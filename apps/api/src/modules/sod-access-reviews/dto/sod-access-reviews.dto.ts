import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export const SOD_ACTIONS = [
  "PRICING_CONFIGURE",
  "PURCHASE_APPROVE",
  "INVOICE_ISSUE",
  "RECONCILIATION_RUN",
] as const;

export class UpsertSodPolicyItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: SOD_ACTIONS })
  @IsString()
  actionA!: string;

  @ApiProperty({ enum: SOD_ACTIONS })
  @IsString()
  actionB!: string;

  @ApiProperty({ enum: ["DENY", "ALERT"], default: "DENY" })
  @IsEnum({ DENY: "DENY", ALERT: "ALERT" } as const)
  mode!: "DENY" | "ALERT";

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpsertSodPoliciesDto {
  @ApiProperty({ type: [UpsertSodPolicyItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertSodPolicyItemDto)
  items!: UpsertSodPolicyItemDto[];
}

export class CreateAccessReviewCampaignDto {
  @ApiProperty({ enum: ["MONTHLY", "QUARTERLY"] })
  @IsEnum({ MONTHLY: "MONTHLY", QUARTERLY: "QUARTERLY" } as const)
  cadence!: "MONTHLY" | "QUARTERLY";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewAccessReviewItemDto {
  @ApiProperty({ enum: ["APPROVE", "REVOKE", "CHANGES_REQUIRED"] })
  @IsEnum({ APPROVE: "APPROVE", REVOKE: "REVOKE", CHANGES_REQUIRED: "CHANGES_REQUIRED" } as const)
  decision!: "APPROVE" | "REVOKE" | "CHANGES_REQUIRED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class SodViolationsQueryDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
