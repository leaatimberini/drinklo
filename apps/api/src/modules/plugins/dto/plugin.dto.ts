import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdatePluginDto {
  @IsString()
  name!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsArray()
  allowedPermissions?: string[];
}
