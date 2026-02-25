import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsISO8601, IsOptional, IsString } from "class-validator";

export const EDISCOVERY_ENTITIES = [
  "orders",
  "invoices",
  "audit",
  "events",
  "config_changes",
  "accesses",
  "legal_holds",
] as const;

export type EdiscoveryEntity = (typeof EDISCOVERY_ENTITIES)[number];

export class EdiscoveryExportDto {
  @ApiPropertyOptional({ isArray: true, enum: EDISCOVERY_ENTITIES })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(EDISCOVERY_ENTITIES, { each: true })
  entities?: EdiscoveryEntity[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class EdiscoveryVerifyDto {
  @ApiPropertyOptional({ description: "eDiscovery export package JSON" })
  @IsOptional()
  pack?: any;
}

