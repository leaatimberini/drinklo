import { Body, Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CheckoutService } from "./checkout.service";
import { ShippingService } from "./shipping.service";
import { CreateOrderDto, QuoteRequestDto } from "./dto/checkout.dto";
import { PdfService } from "../shared/pdf.service";
import { StorageService } from "../storage/storage.service";
import type { Response } from "express";
import type { Request } from "express";

@ApiTags("checkout")
@Controller("checkout")
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly shipping: ShippingService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
  ) {}

  @Post("quote")
  async quote(@Body() body: QuoteRequestDto) {
    const company = await this.checkout.getCompany();
    return this.shipping.quote(company.id, body as any);
  }

  @Post("orders")
  create(@Body() body: CreateOrderDto, @Req() req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded ?? req.ip ?? "");
    const geoCountry = String(req.headers["x-geo-country"] ?? req.headers["cf-ipcountry"] ?? "");
    return this.checkout.createOrder(body, { ip, geoCountry });
  }

  @Get("orders/:id/status")
  status(@Param("id") id: string) {
    return this.checkout.getStatus(id);
  }

  @Get("orders/:id/pdf")
  async orderPdf(@Param("id") id: string, @Res() res: Response) {
    const order = await this.checkout.getOrderWithItems(id);
    const html = this.pdf.renderOrderTemplate({
      ...order,
      currency: "ARS",
    });
    const buffer = await this.pdf.renderPdf(html);
    const key = `pdfs/orders/${id}.pdf`;
    await this.storage.put(key, buffer, "application/pdf");
    const signedUrl = await this.storage.signedUrl(key);
    return res.redirect(signedUrl);
  }
}
