import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class ArcaReadinessDryRunDto {
  @ApiPropertyOptional({ type: [String], description: "Tipos de comprobante a probar (A/B/C/M)", default: ["B", "C"] })
  @IsOptional()
  @IsArray()
  @IsIn(["A", "B", "C", "M"], { each: true })
  invoiceTypes?: Array<"A" | "B" | "C" | "M">;

  @ApiPropertyOptional({ description: "Punto de venta override para dry-run" })
  @IsOptional()
  @IsInt()
  @Min(1)
  pointOfSale?: number;

  @ApiPropertyOptional({ description: "Monto de prueba en ARS", default: 1234.56 })
  @IsOptional()
  @Min(0.01)
  amountArs?: number;
}

export class ArcaReadinessReportDto extends ArcaReadinessDryRunDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeDryRun?: boolean;

  @ApiPropertyOptional({ description: "Notas opcionales del responsable" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ArcaReadinessChecklistQueryDto {
  @ApiPropertyOptional({ type: [String], description: "Tipos previstos de comprobante" })
  @IsOptional()
  @IsArray()
  @IsIn(["A", "B", "C", "M"], { each: true })
  invoiceTypes?: Array<"A" | "B" | "C" | "M">;
}
