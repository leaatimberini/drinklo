import { Module } from "@nestjs/common";
import { AutomationController } from "./automation.controller";
import { AutomationService } from "./automation.service";
import { EmailTemplatesModule } from "../email-templates/email-templates.module";

@Module({
  imports: [EmailTemplatesModule],
  controllers: [AutomationController],
  providers: [AutomationService],
})
export class AutomationModule {}
