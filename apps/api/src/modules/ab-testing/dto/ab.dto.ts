import { IsArray, IsEnum, IsNumber, IsObject, IsOptional, IsString } from "class-validator";
import { ExperimentEventType, ExperimentStatus, ExperimentTarget } from "@erp/db";

export class CreateExperimentDto {
  @IsString()
  name!: string;

  @IsEnum(ExperimentTarget)
  target!: ExperimentTarget;

  @IsOptional()
  @IsEnum(ExperimentStatus)
  status?: ExperimentStatus;

  @IsOptional()
  @IsArray()
  objectives?: string[];

  @IsOptional()
  @IsObject()
  trafficSplit?: Record<string, number>;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;
}

export class CreateVariantDto {
  @IsString()
  name!: string;

  @IsNumber()
  weight!: number;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class RecordExperimentEventDto {
  @IsEnum(ExperimentEventType)
  type!: ExperimentEventType;

  @IsOptional()
  @IsString()
  target?: ExperimentTarget;

  @IsOptional()
  @IsString()
  orderId?: string;
}
