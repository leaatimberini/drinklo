import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FxService } from "./fx.service";
import { FxLatestQueryDto, FxRangeQueryDto } from "./dto/fx.dto";

@ApiTags("fx")
@Controller("fx")
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get("latest")
  latest(@Query() query: FxLatestQueryDto) {
    const codes = query.codes ? query.codes.split(",").map((c) => c.trim()).filter(Boolean) : ["USD", "EUR", "BRL"];
    return this.fx.latest(codes);
  }

  @Get("range")
  range(@Query() query: FxRangeQueryDto) {
    const code = query.code ?? "USD";
    return this.fx.range(code, query.from, query.to);
  }
}
