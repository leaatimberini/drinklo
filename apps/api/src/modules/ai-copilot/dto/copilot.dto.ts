import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CopilotChatDto {
  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  prompt!: string;

  @ApiProperty({ required: false, default: "admin" })
  @IsOptional()
  @IsString()
  mode?: string;
}

export class CopilotApproveDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
