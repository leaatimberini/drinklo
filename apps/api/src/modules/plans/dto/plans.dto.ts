import { IsEnum, IsOptional } from "class-validator";

export class SetNextTierDto {
  @IsOptional()
  @IsEnum({ C1: "C1", C2: "C2", C3: "C3" } as const)
  nextTier?: "C1" | "C2" | "C3" | null;
}

