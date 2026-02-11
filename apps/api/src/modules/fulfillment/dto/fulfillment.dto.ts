import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

export class FulfillmentQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ["PACKED", "SHIPPED"] })
  @IsIn(["PACKED", "SHIPPED"])
  status!: "PACKED" | "SHIPPED";
}
