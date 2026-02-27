-- Bot audit
CREATE TABLE "BotCommandLog" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "adminId" text,
  "chatId" text NOT NULL,
  "command" text NOT NULL,
  "args" text,
  "status" text NOT NULL,
  "result" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "BotCommandLog_chatId_idx" ON "BotCommandLog"("chatId");
CREATE INDEX "BotCommandLog_command_idx" ON "BotCommandLog"("command");

