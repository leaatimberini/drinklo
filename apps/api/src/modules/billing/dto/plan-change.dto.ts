import { IsBoolean, IsEnum, IsOptional } from "class-validator";

export class PlanChangeDto {
  @IsEnum({ C1: "C1", C2: "C2", C3: "C3" } as const)
  targetTier!: "C1" | "C2" | "C3";

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

