import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class AuditQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  actorUserId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  aggregateType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  aggregateId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
