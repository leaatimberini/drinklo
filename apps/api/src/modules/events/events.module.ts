import { Module } from "@nestjs/common";
import { EventsService } from "./events.service";
import { EventsController } from "./events.controller";
import { IntegrationBuilderModule } from "../integration-builder/integration-builder.module";

@Module({
  imports: [IntegrationBuilderModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
