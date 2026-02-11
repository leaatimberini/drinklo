import { IsBoolean, IsDateString, IsObject, IsOptional, IsString } from "class-validator";

export class RotateSecretDto {
  @IsString()
  provider!: string;

  @IsObject()
  payload!: Record<string, any>;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}

export class VerifySecretDto {
  @IsString()
  provider!: string;
}
