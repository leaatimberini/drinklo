import { Body, Controller, Get, Headers, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { EventsService } from "./events.service";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("events")
@Controller()
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("events/ingest")
  async ingest(@Body() body: any, @Headers("x-event-token") token?: string) {
    const required = process.env.EVENT_INGEST_TOKEN;
    if (required && token !== required) {
      return { ok: false, message: "unauthorized" };
    }
    const payload = Array.isArray(body) ? body : body?.events ?? [];
    this.events.enqueue(payload);
    return { ok: true, queued: payload.length };
  }

  @Get("admin/events/stats")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "support")
  async stats(@Req() req: any) {
    const companyId = req.user?.companyId;
    return this.events.getStats(companyId);
  }

  @Get("events/schema")
  async schema() {
    return { ok: true, schemaVersion: 1 };
  }
}
