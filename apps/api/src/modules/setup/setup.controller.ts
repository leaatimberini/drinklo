import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SetupInitializeDto } from "./dto/setup.dto";
import { SetupService } from "./setup.service";

@ApiTags("setup")
@Controller("setup")
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get("status")
  status() {
    return this.setup.status();
  }

  @Post("initialize")
  initialize(@Body() body: SetupInitializeDto) {
    return this.setup.initialize(body);
  }
}
