import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password, body.mfaCode);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"))
  me(@Req() req: { user?: { sub?: string } }) {
    return this.auth.me(req.user?.sub ?? "");
  }

  @Post("refresh")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"))
  refresh(@Req() req: { user?: { sub?: string } }) {
    return this.auth.refresh(req.user?.sub ?? "");
  }

  @Post("logout")
  logout() {
    return this.auth.logout();
  }
}
