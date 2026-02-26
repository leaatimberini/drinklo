import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

export class ImportRequestDto {
  @ApiProperty({ description: "products | variants | prices | stock | customers" })
  @IsString()
  type!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;

  @ApiProperty({ required: false, description: "JSON string mapping canonicalField -> sourceHeader" })
  @IsOptional()
  @IsString()
  columnMappingJson?: string;

  @ApiProperty({ required: false, description: "ICP profile for suggestions/templates (kiosco|distribuidora|bebidas)" })
  @IsOptional()
  @IsString()
  icp?: string;

  @ApiProperty({ required: false, description: "Save/update mapping template with this name" })
  @IsOptional()
  @IsString()
  mappingTemplateName?: string;

  @ApiProperty({ required: false, description: "Persist template after dry-run/import" })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  saveMappingTemplate?: boolean;
}

export class ExportRequestDto {
  @ApiProperty({ description: "products | variants | prices | stock | customers" })
  @IsString()
  type!: string;
}

export class ImportAnalyzeRequestDto extends ImportRequestDto {}

export class SaveImportMappingTemplateDto {
  @ApiProperty({ description: "products | variants | prices | stock | customers" })
  @IsString()
  type!: string;

  @ApiProperty({ description: "kiosco | distribuidora | bebidas", required: false })
  @IsOptional()
  @IsString()
  icp?: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ type: "object", additionalProperties: { type: "string", nullable: true } })
  @IsObject()
  mapping!: Record<string, string | null>;
}
