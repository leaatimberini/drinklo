import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { PortalAuthService } from "./portal-auth.service";
import { PortalService } from "./portal.service";
import { PrismaService } from "../prisma/prisma.service";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { AddMessageDto, CreateTicketDto, PortalLoginDto } from "./dto/portal.dto";

@ApiTags("support-portal")
@Controller("portal")
export class PortalController {
  constructor(
    private readonly auth: PortalAuthService,
    private readonly portal: PortalService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("auth/login")
  async login(@Body() body: PortalLoginDto) {
    const customer = await this.auth.validateLogin(body.email, body.password, body.companyId);
    if (!customer) {
      return { ok: false };
    }
    const token = this.auth.sign({
      sub: customer.id,
      companyId: customer.companyId,
      email: customer.email,
    });
    return {
      ok: true,
      token,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        companyId: customer.companyId,
        companyName: customer.companyName,
      },
    };
  }

  @Get("tickets")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("portal-jwt"))
  tickets(@Req() req: any) {
    return this.portal.listTickets(req.user.companyId, req.user.sub);
  }

  @Post("tickets")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("portal-jwt"))
  createTicket(@Req() req: any, @Body() body: CreateTicketDto) {
    return this.portal.createTicket(
      req.user.companyId,
      req.user.sub,
      body.subject,
      body.message,
      body.priority,
    );
  }

  @Get("tickets/detail")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("portal-jwt"))
  ticket(@Req() req: any) {
    const id = req.query.id;
    return this.portal.getTicket(req.user.companyId, req.user.sub, id);
  }

  @Post("tickets/message")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("portal-jwt"))
  addMessage(@Req() req: any, @Body() body: AddMessageDto) {
    const ticketId = req.query.id;
    return this.portal.addMessage(req.user.companyId, req.user.sub, ticketId, body.message);
  }

  @Post("tickets/diagnostic")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("portal-jwt"))
  attachDiagnostic(@Req() req: any) {
    const ticketId = req.query.id;
    return this.portal.attachDiagnostic(req.user.companyId, req.user.sub, ticketId);
  }

  @Get("incidents")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("portal-jwt"))
  incidents(@Req() req: any) {
    return this.portal.listIncidents(req.user.companyId);
  }

  @Get("integrations")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("portal-jwt"))
  integrations(@Req() req: any) {
    return this.portal.listIntegrations(req.user.companyId);
  }

  @Post("email/inbound")
  async inboundEmail(@Body() body: any, @Req() req: any) {
    if (process.env.SUPPORT_EMAIL_INBOUND_ENABLED !== "true") {
      return { ok: false, message: "disabled" };
    }
    const token = req.headers["x-support-email-token"];
    if (process.env.SUPPORT_EMAIL_INBOUND_TOKEN && token !== process.env.SUPPORT_EMAIL_INBOUND_TOKEN) {
      return { ok: false, message: "unauthorized" };
    }

    const companyId = body.companyId;
    if (!companyId) {
      return { ok: false, message: "companyId required" };
    }

    const email = String(body.from ?? "").toLowerCase();
    const subject = String(body.subject ?? "Inbound email");
    const message = String(body.text ?? body.html ?? "");

    let customer = await this.prisma.supportCustomer.findFirst({
      where: { companyId, email },
    });
    if (!customer) {
      const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
      customer = await this.prisma.supportCustomer.create({
        data: { companyId, email, name: email || "Inbound", passwordHash },
      });
    }

    const ticket = await this.portal.createTicket(companyId, customer.id, subject, message);
    return { ok: true, ticketId: ticket.id };
  }
}
