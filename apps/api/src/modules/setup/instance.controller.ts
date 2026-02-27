import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SetupService } from "./setup.service";

@ApiTags("installer")
@Controller("instance")
export class InstanceController {
  constructor(private readonly setup: SetupService) {}

  @Get("status")
  status() {
    return this.setup.instanceStatus();
  }
}
