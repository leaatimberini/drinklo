import { Body, Controller, Delete, Get, Param, Post, Put, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { QuotesService } from "./quotes.service";
import { CreateQuoteDto, UpdateQuoteDto } from "./dto/quotes.dto";
import { PdfService } from "../shared/pdf.service";
import { StorageService } from "../storage/storage.service";

@ApiTags("quotes")
@Controller("quotes")
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list() {
    return this.quotes.list();
  }

  @Post()
  create(@Body() body: CreateQuoteDto) {
    return this.quotes.create(body);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.quotes.get(id);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() body: UpdateQuoteDto) {
    return this.quotes.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.quotes.remove(id);
  }

  @Post(":id/convert")
  convert(@Param("id") id: string) {
    return this.quotes.convertToSale(id);
  }

  @Get(":id/pdf")
  async pdfDownload(@Param("id") id: string, @Res() res: Response) {
    const quote = await this.quotes.get(id);
    const html = this.pdf.renderQuoteTemplate(quote);
    const buffer = await this.pdf.renderPdf(html);
    const key = `pdfs/quotes/${id}.pdf`;
    await this.storage.put(key, buffer, "application/pdf");
    const signedUrl = await this.storage.signedUrl(key);
    return res.redirect(signedUrl);
  }
}
