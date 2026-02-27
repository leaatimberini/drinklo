import { Module } from "@nestjs/common";
import { EmailTemplatesController } from "./email-templates.controller";
import { EmailTemplatesService } from "./email-templates.service";
import { LicensingModule } from "../licensing/licensing.module";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [LicensingModule, EventsModule],
  controllers: [EmailTemplatesController],
  providers: [EmailTemplatesService],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
