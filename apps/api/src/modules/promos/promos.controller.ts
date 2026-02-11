import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { PromosService } from "./promos.service";
import { CreateCouponDto, CreateGiftCardDto, CreateLoyaltyRuleDto, CreateLoyaltyTierDto, ValidateCouponDto } from "./dto/promos.dto";

@ApiTags("promos")
@ApiBearerAuth()
@Controller("admin/promos")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles("admin", "manager", "marketing")
export class PromosController {
  constructor(private readonly promos: PromosService) {}

  @Get("coupons")
  listCoupons(@Req() req: any) {
    return this.promos.listCoupons(req.user.companyId);
  }

  @Post("coupons")
  createCoupon(@Req() req: any, @Body() body: CreateCouponDto) {
    return this.promos.createCoupon(req.user.companyId, body);
  }

  @Post("coupons/validate")
  validateCoupon(@Req() req: any, @Body() body: ValidateCouponDto) {
    return this.promos.validateCoupon(req.user.companyId, body);
  }

  @Get("giftcards")
  listGiftCards(@Req() req: any) {
    return this.promos.listGiftCards(req.user.companyId);
  }

  @Post("giftcards")
  createGiftCard(@Req() req: any, @Body() body: CreateGiftCardDto) {
    return this.promos.createGiftCard(req.user.companyId, body, req.user.id);
  }

  @Get("giftcards/:code/balance")
  balance(@Req() req: any, @Param("code") code: string) {
    return this.promos.getGiftCardBalance(req.user.companyId, code);
  }

  @Get("loyalty/tiers")
  listTiers(@Req() req: any) {
    return this.promos.listLoyaltyTiers(req.user.companyId);
  }

  @Post("loyalty/tiers")
  createTier(@Req() req: any, @Body() body: CreateLoyaltyTierDto) {
    return this.promos.createLoyaltyTier(req.user.companyId, body);
  }

  @Get("loyalty/rules")
  listRules(@Req() req: any) {
    return this.promos.listLoyaltyRules(req.user.companyId);
  }

  @Post("loyalty/rules")
  createRule(@Req() req: any, @Body() body: CreateLoyaltyRuleDto) {
    return this.promos.createLoyaltyRule(req.user.companyId, body);
  }
}
