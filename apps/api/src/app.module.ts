import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./modules/config/env.schema";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "./modules/auth/auth.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { ProductsModule } from "./modules/products/products.module";
import { StockModule } from "./modules/stock/stock.module";
import { SetupModule } from "./modules/setup/setup.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { ThemesModule } from "./modules/themes/themes.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { CheckoutModule } from "./modules/checkout/checkout.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { SalesModule } from "./modules/sales/sales.module";
import { QuotesModule } from "./modules/quotes/quotes.module";
import { SharedModule } from "./modules/shared/shared.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { FxModule } from "./modules/fx/fx.module";
import { ScheduleModule } from "@nestjs/schedule";
import { BillingModule } from "./modules/billing/billing.module";
import { HealthModule } from "./modules/health/health.module";
import { OpsModule } from "./modules/ops/ops.module";
import { ThrottlerModule } from "@nestjs/throttler";
import { ApiThrottlerGuard, throttlerOptions } from "./security/throttling";
import { StockReservationModule } from "./modules/stock-reservations/stock-reservation.module";
import { BrandingModule } from "./modules/branding/branding.module";
import { EmailTemplatesModule } from "./modules/email-templates/email-templates.module";
import { BotAuditModule } from "./modules/bot-audit/bot-audit.module";
import { StorageModule } from "./modules/storage/storage.module";
import { LicensingModule } from "./modules/licensing/licensing.module";
import { ComplianceModule } from "./modules/compliance/compliance.module";
import { ImportExportModule } from "./modules/import-export/import-export.module";
import { DomainEmailModule } from "./modules/domain-email/domain-email.module";
import { PrivacyModule } from "./modules/privacy/privacy.module";
import { ReconciliationModule } from "./modules/reconciliation/reconciliation.module";
import { SupportModule } from "./modules/support/support.module";
import { StarterPacksModule } from "./modules/starter-packs/starter-packs.module";
import { SecretsModule } from "./modules/secrets/secrets.module";
import { MetricsModule } from "./modules/metrics/metrics.module";
import { MetricsInterceptor } from "./modules/metrics/metrics.interceptor";
import { IntegrationsHealthModule } from "./modules/integrations-health/integrations-health.module";
import { PortalModule } from "./modules/support-portal/portal.module";
import { PluginsModule } from "./modules/plugins/plugins.module";
import { PluginMarketplaceModule } from "./modules/plugin-marketplace/plugin-marketplace.module";
import { EventsModule } from "./modules/events/events.module";
import { WarehouseModule } from "./modules/warehouse/warehouse.module";
import { AutomationModule } from "./modules/automation/automation.module";
import { PromosModule } from "./modules/promos/promos.module";
import { AbTestingModule } from "./modules/ab-testing/ab-testing.module";
import { FulfillmentModule } from "./modules/fulfillment/fulfillment.module";
import { SearchModule } from "./modules/search/search.module";
import { RecommendationsModule } from "./modules/recommendations/recommendations.module";
import { IamModule } from "./modules/iam/iam.module";
import { ImmutableAuditModule } from "./modules/immutable-audit/immutable-audit.module";
import { ImmutableAuditInterceptor } from "./modules/immutable-audit/immutable-audit.interceptor";
import { PurchasingModule } from "./modules/purchasing/purchasing.module";
import { LotsModule } from "./modules/lots/lots.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(throttlerOptions),
    PrismaModule,
    SetupModule,
    ThemesModule,
    CatalogModule,
    CheckoutModule,
    PaymentsModule,
    SalesModule,
    SharedModule,
    QuotesModule,
    DashboardModule,
    FxModule,
    BillingModule,
    HealthModule,
    OpsModule,
    StockReservationModule,
    BrandingModule,
    EmailTemplatesModule,
    BotAuditModule,
    StorageModule,
    LicensingModule,
    ComplianceModule,
    ImportExportModule,
    DomainEmailModule,
    PrivacyModule,
    ReconciliationModule,
    SupportModule,
    StarterPacksModule,
    SecretsModule,
    MetricsModule,
    IntegrationsHealthModule,
    PortalModule,
    PluginsModule,
    PluginMarketplaceModule,
    EventsModule,
    WarehouseModule,
    AutomationModule,
    PromosModule,
    AbTestingModule,
    FulfillmentModule,
    SearchModule,
    RecommendationsModule,
    IamModule,
    ImmutableAuditModule,
    PurchasingModule,
    LotsModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    ProductsModule,
    CustomersModule,
    StockModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ImmutableAuditInterceptor,
    },
  ],
})
export class AppModule {}
