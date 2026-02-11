import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export class UpsertEmailDomainDto {
  @ApiProperty({ enum: ["SMTP", "API"] })
  @IsIn(["SMTP", "API"])
  providerType!: "SMTP" | "API";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  spfValue?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dkimSelector?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dkimValue?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dmarcValue?: string;
}

export class VerifyEmailDomainDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}

export class EmailEventDto {
  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recipient?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  messageId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  provider?: string;
}
