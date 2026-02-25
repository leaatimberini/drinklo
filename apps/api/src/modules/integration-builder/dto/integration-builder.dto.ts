import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class UpsertIntegrationConnectorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  sourceEvent!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: ["WEBHOOK", "API"], default: "WEBHOOK" })
  @IsOptional()
  @IsString()
  destinationType?: "WEBHOOK" | "API";

  @ApiPropertyOptional({ default: "POST" })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiProperty()
  @IsString()
  destinationUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  headers?: Record<string, unknown>;

  @ApiProperty({ description: "Mapping JSON template (strings starting with $. resolve from event)" })
  @IsObject()
  mapping!: Record<string, unknown>;

  @ApiPropertyOptional({ default: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  @Max(120000)
  timeoutMs?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  retryMaxAttempts?: number;

  @ApiPropertyOptional({ default: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(60000)
  retryBackoffBaseMs?: number;

  @ApiPropertyOptional({ enum: ["NONE", "BEARER_TOKEN", "API_KEY_HEADER"], default: "NONE" })
  @IsOptional()
  @IsString()
  authMode?: "NONE" | "BEARER_TOKEN" | "API_KEY_HEADER";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authHeaderName?: string;
}

export class UpsertIntegrationConnectorsDto {
  @ApiProperty({ type: [UpsertIntegrationConnectorDto] })
  @IsArray()
  items!: UpsertIntegrationConnectorDto[];
}

export class IntegrationBuilderPreviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  connector?: Partial<UpsertIntegrationConnectorDto>;

  @ApiProperty()
  @IsObject()
  sampleEvent!: Record<string, unknown>;
}

export class ConnectorSecretRotateDto {
  @ApiProperty()
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class DeliveryLogsQueryDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

