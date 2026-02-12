import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class LotAlertsQueryDto {
  @ApiProperty({ required: false, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class RotationSuggestionsQueryDto {
  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class UpdateFefoConfigDto {
  @ApiProperty({ enum: ["FEFO", "FIFO"] })
  @IsString()
  @IsIn(["FEFO", "FIFO"])
  pickingStrategy!: "FEFO" | "FIFO";

  @ApiProperty()
  @IsBoolean()
  blockExpiredLotSale!: boolean;
}
