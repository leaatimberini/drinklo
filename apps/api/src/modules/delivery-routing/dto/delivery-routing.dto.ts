import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export class CreateDeliveryWindowDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ example: "09:00" })
  @IsString()
  startTime!: string;

  @ApiProperty({ example: "13:00" })
  @IsString()
  endTime!: string;
}

export class GenerateRouteDto {
  @ApiProperty({ example: "2026-02-11" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  windowId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverName?: string;
}

export class UpdateStopStatusDto {
  @ApiProperty({ enum: ["PENDING", "EN_ROUTE", "DELIVERED", "FAILED", "SKIPPED"] })
  @IsIn(["PENDING", "EN_ROUTE", "DELIVERED", "FAILED", "SKIPPED"])
  status!: "PENDING" | "EN_ROUTE" | "DELIVERED" | "FAILED" | "SKIPPED";
}
