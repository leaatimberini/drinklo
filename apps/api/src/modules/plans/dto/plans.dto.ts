import { IsEnum, IsOptional } from "class-validator";

export class SetNextTierDto {
  @IsOptional()
  @IsEnum({ C1: "C1", C2: "C2", C3: "C3" } as const)
  nextTier?: "C1" | "C2" | "C3" | null;
}

export class UpdateRestrictedModeVariantDto {
  @IsEnum({ CATALOG_ONLY: "CATALOG_ONLY", ALLOW_BASIC_SALES: "ALLOW_BASIC_SALES" } as const)
  variant!: "CATALOG_ONLY" | "ALLOW_BASIC_SALES";
}
