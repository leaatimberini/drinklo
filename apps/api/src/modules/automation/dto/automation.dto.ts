import { IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";
import { ActionType, CampaignStatus, FlowStatus, TriggerType } from "@erp/db";

export class CreateSegmentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  definition!: Record<string, any>;
}

export class CreateCampaignDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsString()
  segmentId?: string;
}

export class CreateTriggerDto {
  @IsEnum(TriggerType)
  type!: TriggerType;

  @IsObject()
  config!: Record<string, any>;
}

export class CreateFlowDto {
  @IsString()
  name!: string;

  @IsString()
  triggerId!: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsEnum(FlowStatus)
  status?: FlowStatus;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class UpdateFlowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(FlowStatus)
  status?: FlowStatus;

  @IsOptional()
  @IsString()
  triggerId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class CreateActionDto {
  @IsEnum(ActionType)
  type!: ActionType;

  @IsObject()
  config!: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(0)
  delayMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateActionDto {
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(0)
  delayMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateSuppressionDto {
  @IsString()
  channel!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RunFlowDto {
  @IsString()
  recipient!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}

export class RecordMetricDto {
  @IsIn(["open", "conversion"])
  type!: "open" | "conversion";

  @IsOptional()
  @IsString()
  date?: string;
}

export class UpdateTriggerDto {
  @IsOptional()
  @IsEnum(TriggerType)
  type?: TriggerType;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
