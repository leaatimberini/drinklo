import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mfaCode?: string;
}
