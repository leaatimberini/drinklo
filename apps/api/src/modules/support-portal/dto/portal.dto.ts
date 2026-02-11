import { IsEmail, IsOptional, IsString } from "class-validator";

export class PortalLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}

export class CreateTicketDto {
  @IsString()
  subject!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  priority?: string;
}

export class AddMessageDto {
  @IsString()
  message!: string;
}
