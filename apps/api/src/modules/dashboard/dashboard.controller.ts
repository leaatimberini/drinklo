import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import * as XLSX from "xlsx";
import { DashboardService } from "./dashboard.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("summary")
  summary(@Query() query: DashboardQueryDto) {
    return this.dashboard.summary(query);
  }

  @Get("export.csv")
  async exportCsv(@Query() query: DashboardQueryDto, @Res() res: Response) {
    const data = await this.dashboard.summary(query);
    const rows = data.topProducts.map((item) => ({
      productId: item.productId,
      name: item.name,
      revenue: item.revenue,
      qty: item.qty,
    }));

    const header = "productId,name,revenue,qty";
    const body = rows.map((r) => `${r.productId},${r.name},${r.revenue},${r.qty}`).join("\n");
    const csv = `${header}\n${body}`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=dashboard.csv");
    res.send(csv);
  }

  @Get("export.xlsx")
  async exportXlsx(@Query() query: DashboardQueryDto, @Res() res: Response) {
    const data = await this.dashboard.summary(query);
    const rows = data.topProducts.map((item) => ({
      productId: item.productId,
      name: item.name,
      revenue: item.revenue,
      qty: item.qty,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TopProducts");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=dashboard.xlsx");
    res.send(buffer);
  }
}
