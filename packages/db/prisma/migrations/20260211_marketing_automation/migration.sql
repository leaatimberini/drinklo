CREATE TYPE "TriggerType" AS ENUM ('CART_ABANDONED','POST_PURCHASE','BIRTHDAY','STOCK_BACK','WINBACK');
CREATE TYPE "ActionType" AS ENUM ('EMAIL','PUSH','IN_APP','TELEGRAM','COUPON');
CREATE TYPE "FlowStatus" AS ENUM ('DRAFT','ACTIVE','PAUSED','ARCHIVED');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT','ACTIVE','PAUSED','ARCHIVED');

CREATE TABLE "Segment" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "definition" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Campaign" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "segmentId" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Trigger" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "type" "TriggerType" NOT NULL,
  "config" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "Trigger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Flow" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "campaignId" text,
  "triggerId" text NOT NULL,
  "name" text NOT NULL,
  "status" "FlowStatus" NOT NULL DEFAULT 'DRAFT',
  "settings" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Action" (
  "id" text NOT NULL,
  "flowId" text NOT NULL,
  "type" "ActionType" NOT NULL,
  "config" jsonb NOT NULL,
  "delayMinutes" integer NOT NULL DEFAULT 0,
  "position" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SuppressionList" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "channel" text NOT NULL,
  "value" text NOT NULL,
  "reason" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "SuppressionList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationSendLog" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "flowId" text NOT NULL,
  "channel" text NOT NULL,
  "recipient" text NOT NULL,
  "sentAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationSendLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowMetric" (
  "id" text NOT NULL,
  "flowId" text NOT NULL,
  "companyId" text NOT NULL,
  "date" timestamp(3) NOT NULL,
  "sent" integer NOT NULL DEFAULT 0,
  "opened" integer NOT NULL DEFAULT 0,
  "converted" integer NOT NULL DEFAULT 0,
  CONSTRAINT "FlowMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Segment_companyId_name_key" ON "Segment"("companyId", "name");
CREATE INDEX "Segment_companyId_idx" ON "Segment"("companyId");

CREATE INDEX "Campaign_companyId_idx" ON "Campaign"("companyId");
CREATE INDEX "Campaign_segmentId_idx" ON "Campaign"("segmentId");
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

CREATE INDEX "Trigger_companyId_idx" ON "Trigger"("companyId");
CREATE INDEX "Trigger_type_idx" ON "Trigger"("type");

CREATE INDEX "Flow_companyId_idx" ON "Flow"("companyId");
CREATE INDEX "Flow_campaignId_idx" ON "Flow"("campaignId");
CREATE INDEX "Flow_triggerId_idx" ON "Flow"("triggerId");
CREATE INDEX "Flow_status_idx" ON "Flow"("status");

CREATE INDEX "Action_flowId_idx" ON "Action"("flowId");
CREATE INDEX "Action_type_idx" ON "Action"("type");

CREATE UNIQUE INDEX "SuppressionList_companyId_channel_value_key" ON "SuppressionList"("companyId", "channel", "value");
CREATE INDEX "SuppressionList_companyId_idx" ON "SuppressionList"("companyId");
CREATE INDEX "SuppressionList_channel_idx" ON "SuppressionList"("channel");

CREATE INDEX "AutomationSendLog_companyId_idx" ON "AutomationSendLog"("companyId");
CREATE INDEX "AutomationSendLog_flowId_idx" ON "AutomationSendLog"("flowId");
CREATE INDEX "AutomationSendLog_channel_idx" ON "AutomationSendLog"("channel");
CREATE INDEX "AutomationSendLog_recipient_idx" ON "AutomationSendLog"("recipient");
CREATE INDEX "AutomationSendLog_sentAt_idx" ON "AutomationSendLog"("sentAt");

CREATE UNIQUE INDEX "FlowMetric_flowId_date_key" ON "FlowMetric"("flowId", "date");
CREATE INDEX "FlowMetric_companyId_idx" ON "FlowMetric"("companyId");
CREATE INDEX "FlowMetric_flowId_idx" ON "FlowMetric"("flowId");
CREATE INDEX "FlowMetric_date_idx" ON "FlowMetric"("date");

ALTER TABLE "Segment" ADD CONSTRAINT "Segment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Trigger" ADD CONSTRAINT "Trigger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "Trigger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SuppressionList" ADD CONSTRAINT "SuppressionList_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationSendLog" ADD CONSTRAINT "AutomationSendLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationSendLog" ADD CONSTRAINT "AutomationSendLog_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowMetric" ADD CONSTRAINT "FlowMetric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlowMetric" ADD CONSTRAINT "FlowMetric_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
