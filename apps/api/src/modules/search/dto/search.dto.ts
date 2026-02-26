import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsObject, IsOptional, IsString, Min } from "class-validator";

export class SearchQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class SearchConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  synonyms?: Record<string, string[]>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  boosters?: {
    stockWeight?: number;
    marginWeight?: number;
  };
}

export class SearchReindexDto {
  @ApiProperty({ enum: ["full", "incremental"] })
  @IsString()
  mode!: "full" | "incremental";
}
