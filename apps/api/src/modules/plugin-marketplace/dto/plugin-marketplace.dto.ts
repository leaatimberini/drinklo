import { IsOptional, IsString } from "class-validator";

export class PluginRequestDto {
  @IsString()
  pluginName!: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsString()
  action!: string;
}
