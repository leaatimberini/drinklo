import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { EmailTemplatesService } from "./email-templates.service";
import { GenerateEmailDto, SendTestEmailDto, UpdateEmailTemplateDto } from "./dto/email-template.dto";

@ApiTags("email-templates")
@ApiBearerAuth()
@Controller("admin/email-templates")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles("admin")
export class EmailTemplatesController {
  constructor(private readonly emails: EmailTemplatesService) {}

  @Get()
  list() {
    return this.emails.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.emails.get(id);
  }

  @Post("generate")
  generate(@Body() body: GenerateEmailDto) {
    return this.emails.generate(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: UpdateEmailTemplateDto) {
    return this.emails.update(id, body);
  }

  @Post(":id/approve")
  approve(@Param("id") id: string) {
    return this.emails.approve(id);
  }

  @Post(":id/send-test")
  sendTest(@Param("id") id: string, @Body() body: SendTestEmailDto) {
    return this.emails.sendTest(id, body);
  }
}
