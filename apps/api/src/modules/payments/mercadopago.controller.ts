import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreatePreferenceDto } from "./dto/create-preference.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("payments")
@Controller("payments/mercadopago")
export class MercadoPagoController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("preference")
  createPreference(@Body() body: CreatePreferenceDto) {
    return this.payments.createPreference(body.orderId);
  }
}
