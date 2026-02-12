import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export class UpdateIamConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  ssoEnabled?: boolean;

  @ApiProperty({ required: false, enum: ["NONE", "OIDC", "SAML"] })
  @IsOptional()
  @IsIn(["NONE", "OIDC", "SAML"])
  ssoProtocol?: "NONE" | "OIDC" | "SAML";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  oidcIssuer?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  oidcClientId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  oidcClientSecret?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  oidcAuthUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  oidcTokenUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  oidcJwksUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  oidcRedirectUri?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  oidcScopes?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  samlEntityId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  samlSsoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  samlCertificate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  samlAudience?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  mfaRequiredRoles?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  scimEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  scimBearerToken?: string;
}

export class TestIamConnectionDto {
  @ApiProperty({ enum: ["OIDC", "SAML"] })
  @IsString()
  @IsIn(["OIDC", "SAML"])
  protocol!: "OIDC" | "SAML";
}

export class VerifyMfaDto {
  @ApiProperty()
  @IsString()
  code!: string;
}

export class SsoMockLoginDto {
  @ApiProperty({ enum: ["OIDC", "SAML"] })
  @IsIn(["OIDC", "SAML"])
  protocol!: "OIDC" | "SAML";

  @ApiProperty({ description: "Use mock token format: mock:<email>[:<name>]" })
  @IsString()
  token!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyId?: string;
}
