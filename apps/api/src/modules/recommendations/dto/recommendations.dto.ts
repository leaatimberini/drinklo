import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RecommendationsQueryDto {
  @ApiPropertyOptional({ description: "Comma-separated blocks (reorder,cross,upsell)" })
  @IsOptional()
  @IsString()
  blocks?: string;

  @ApiPropertyOptional({ description: "Comma-separated productIds from cart" })
  @IsOptional()
  @IsString()
  cartProductIds?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ageVerified?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  optOut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;
}
