import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min } from "class-validator";
import { DEVELOPER_API_SCOPES } from "../developer-api.service";

export class CreateDeveloperApiKeyDto {
  @IsString()
  name!: string;

  @IsArray()
  @IsIn(DEVELOPER_API_SCOPES, { each: true })
  scopes!: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  rateLimitPerMin?: number;
}

export class UpdateDeveloperApiKeyDto {
  @IsOptional()
  @IsArray()
  @IsIn(DEVELOPER_API_SCOPES, { each: true })
  scopes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  rateLimitPerMin?: number;
}

export class DeveloperApiUsageQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class CreateDeveloperWebhookDto {
  @IsString()
  name!: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @IsIn(["OrderCreated", "PaymentApproved", "StockLow"], { each: true })
  events!: string[];

  @IsString()
  secret!: string;
}
