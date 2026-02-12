import { IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class WebVitalDto {
  @IsString()
  @MaxLength(32)
  name!: string;

  @IsNumber()
  @Min(0)
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  rating?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  path?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  id?: string;
}
