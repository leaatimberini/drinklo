import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CreatePreferenceDto {
  @ApiProperty()
  @IsString()
  orderId!: string;
}
