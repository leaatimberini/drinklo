import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { InstallerBootstrapDto } from "./dto/installer-bootstrap.dto";
import { SetupService } from "./setup.service";

@ApiTags("installer")
@Controller("installer")
export class InstallerController {
  constructor(private readonly setup: SetupService) {}

  @Post("bootstrap")
  bootstrap(@Body() body: InstallerBootstrapDto) {
    return this.setup.bootstrap(body);
  }
}
