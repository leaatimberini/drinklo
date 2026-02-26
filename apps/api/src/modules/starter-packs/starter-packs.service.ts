import { Injectable } from "@nestjs/common";
import { Prisma } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";

const BEVERAGE_CATEGORIES = [
  "Bebidas",
  "Cervezas",
  "Vinos",
  "Espirituosas",
  "Sin Alcohol",
  "Aguas",
  "Jugos",
];

const BEVERAGE_ATTRIBUTES = [
  { key: "brand", label: "Marca", dataType: "string" },
  { key: "origin", label: "Origen", dataType: "string" },
  { key: "style", label: "Estilo", dataType: "string" },
  { key: "varietal", label: "Varietal", dataType: "string" },
  { key: "abv", label: "Graduación", dataType: "number" },
  { key: "ibu", label: "IBU", dataType: "number" },
  { key: "volume_ml", label: "Volumen (ml)", dataType: "number" },
  { key: "package", label: "Envase", dataType: "string" },
];

const BASE_EMAIL_TEMPLATES = [
  { type: "order_confirmation", subject: "Confirmación de pedido", body: "<p>Gracias por tu compra.</p>" },
  { type: "cart_abandonment", subject: "Recordatorio de carrito", body: "<p>Tu carrito te espera.</p>" },
  { type: "promo", subject: "Promo especial", body: "<p>Descubrí nuestras ofertas.</p>" },
];

const BASE_DASHBOARDS = [
  { name: "Ventas diarias", config: { widgets: ["sales", "tickets", "top_products"] } },
  { name: "Stock crítico", config: { widgets: ["stock_critical", "inventory_value"] } },
];

const BASE_REPORTS = [
  { name: "Reporte ventas", config: { columns: ["date", "total", "paymentMethod"] } },
  { name: "Reporte stock", config: { columns: ["sku", "location", "quantity"] } },
];

const PACKAGE_DEFS: Record<
  string,
  {
    id: string;
    label: string;
    featureFlags: Partial<{
      enableMercadoLibre: boolean;
      enableAndreani: boolean;
      enableOwnDelivery: boolean;
      enableAfip: boolean;
    }>;
    includeCatalog: boolean;
    themes: { adminTheme: "A" | "B" | "C"; storefrontTheme: "A" | "B" | "C" };
    emailTemplates: typeof BASE_EMAIL_TEMPLATES;
    dashboards: typeof BASE_DASHBOARDS;
    reports: typeof BASE_REPORTS;
  }
> = {
  bebidas_base: {
    id: "bebidas_base",
    label: "Bebidas (base)",
    featureFlags: { enableOwnDelivery: true },
    includeCatalog: true,
    themes: { adminTheme: "A", storefrontTheme: "A" },
    emailTemplates: BASE_EMAIL_TEMPLATES,
    dashboards: BASE_DASHBOARDS,
    reports: BASE_REPORTS,
  },
  bebidas_mayorista: {
    id: "bebidas_mayorista",
    label: "Bebidas + Mayorista",
    featureFlags: { enableOwnDelivery: true },
    includeCatalog: true,
    themes: { adminTheme: "B", storefrontTheme: "B" },
    emailTemplates: BASE_EMAIL_TEMPLATES,
    dashboards: [
      ...BASE_DASHBOARDS,
      { name: "Mayoristas", config: { widgets: ["top_customers", "wholesale_volume"] } },
    ],
    reports: [
      ...BASE_REPORTS,
      { name: "Reporte mayorista", config: { columns: ["customer", "volume", "total"] } },
    ],
  },
  bebidas_marketplaces: {
    id: "bebidas_marketplaces",
    label: "Bebidas + Marketplaces",
    featureFlags: { enableMercadoLibre: true, enableAndreani: true },
    includeCatalog: true,
    themes: { adminTheme: "C", storefrontTheme: "B" },
    emailTemplates: [
      ...BASE_EMAIL_TEMPLATES,
      { type: "marketplace_order", subject: "Pedido marketplace", body: "<p>Nuevo pedido marketplace.</p>" },
    ],
    dashboards: [
      ...BASE_DASHBOARDS,
      { name: "Marketplaces", config: { widgets: ["marketplace_sales", "marketplace_status"] } },
    ],
    reports: [
      ...BASE_REPORTS,
      { name: "Reporte marketplaces", config: { columns: ["channel", "orders", "total"] } },
    ],
  },
  bebidas_arca: {
    id: "bebidas_arca",
    label: "Bebidas + ARCA",
    featureFlags: { enableAfip: true },
    includeCatalog: true,
    themes: { adminTheme: "A", storefrontTheme: "C" },
    emailTemplates: [
      ...BASE_EMAIL_TEMPLATES,
      { type: "invoice_ready", subject: "Factura disponible", body: "<p>Tu factura ya está lista.</p>" },
    ],
    dashboards: [
      ...BASE_DASHBOARDS,
      { name: "Fiscal", config: { widgets: ["invoices", "tax_summary"] } },
    ],
    reports: [
      ...BASE_REPORTS,
      { name: "Reporte fiscal", config: { columns: ["invoice", "cae", "total"] } },
    ],
  },
};

@Injectable()
export class StarterPacksService {
  constructor(private readonly prisma: PrismaService) {}

  async applyCatalog(companyId: string) {
    for (const name of BEVERAGE_CATEGORIES) {
      const existing = await this.prisma.category.findFirst({ where: { companyId, name } });
      if (!existing) {
        await this.prisma.category.create({ data: { companyId, name } });
      }
    }

    for (const attr of BEVERAGE_ATTRIBUTES) {
      await this.prisma.attributeDefinition.upsert({
        where: { companyId_key: { companyId, key: attr.key } },
        update: { label: attr.label, dataType: attr.dataType },
        create: {
          companyId,
          key: attr.key,
          label: attr.label,
          dataType: attr.dataType,
        },
      });
    }
  }

  async applyTemplates(companyId: string) {
    for (const template of BASE_EMAIL_TEMPLATES) {
      const latest = await this.prisma.emailTemplate.findFirst({
        where: { companyId, type: template.type },
        orderBy: { version: "desc" },
      });
      const version = (latest?.version ?? 0) + 1;
      await this.prisma.emailTemplate.create({
        data: {
          companyId,
          type: template.type,
          subject: template.subject,
          body: template.body,
          version,
          status: "DRAFT",
        },
      });
    }

    for (const tpl of BASE_DASHBOARDS) {
      await this.prisma.dashboardTemplate.create({
        data: { companyId, name: tpl.name, config: tpl.config as Prisma.InputJsonValue },
      });
    }

    for (const tpl of BASE_REPORTS) {
      await this.prisma.reportTemplate.create({
        data: { companyId, name: tpl.name, config: tpl.config as Prisma.InputJsonValue },
      });
    }
  }

  async applyPackage(companyId: string, packageId: string) {
    const pack = PACKAGE_DEFS[packageId];
    if (!pack) {
      throw new Error("Unknown package");
    }

    if (pack.includeCatalog) {
      await this.applyCatalog(companyId);
    }

    await this.prisma.companySettings.update({
      where: { companyId },
      data: {
        ...pack.featureFlags,
        adminTheme: pack.themes.adminTheme,
        storefrontTheme: pack.themes.storefrontTheme,
      },
    });

    for (const template of pack.emailTemplates) {
      const latest = await this.prisma.emailTemplate.findFirst({
        where: { companyId, type: template.type },
        orderBy: { version: "desc" },
      });
      const version = (latest?.version ?? 0) + 1;
      await this.prisma.emailTemplate.create({
        data: {
          companyId,
          type: template.type,
          subject: template.subject,
          body: template.body,
          version,
          status: "DRAFT",
        },
      });
    }

    for (const tpl of pack.dashboards) {
      await this.prisma.dashboardTemplate.create({
        data: { companyId, name: tpl.name, config: tpl.config as Prisma.InputJsonValue },
      });
    }

    for (const tpl of pack.reports) {
      await this.prisma.reportTemplate.create({
        data: { companyId, name: tpl.name, config: tpl.config as Prisma.InputJsonValue },
      });
    }

    return pack;
  }

  getPackages() {
    return Object.values(PACKAGE_DEFS).map((pack) => ({
      id: pack.id,
      label: pack.label,
      features: pack.featureFlags,
      themes: pack.themes,
      includeCatalog: pack.includeCatalog,
    }));
  }
}
