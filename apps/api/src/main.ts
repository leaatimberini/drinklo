import "reflect-metadata";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { requestIdMiddleware } from "./observability/request-id.middleware";
import { loggingMiddleware } from "./observability/logging.middleware";
import { initSentry } from "./observability/sentry";
import { initTelemetry } from "./observability/telemetry";
import { OpsService } from "./modules/ops/ops.service";
import { ObservabilityExceptionFilter } from "./observability/exception.filter";
import { SanitizationPipe } from "./security/sanitization.pipe";
import { csrfMiddleware } from "./security/csrf.middleware";
import { execSync } from "node:child_process";
import { loadApiVersionPolicy } from "./modules/config/api-versioning";

initTelemetry();
initSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const versionPolicy = loadApiVersionPolicy();

  app.use(helmet());
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use(loggingMiddleware);
  app.use(csrfMiddleware);
  app.use((req: any, res: any, next: any) => {
    const rawVersion = req.headers["x-api-version"] ?? req.query?.apiVersion;
    const requestedVersion = Number(rawVersion ?? versionPolicy.defaultVersion);
    if (!Number.isFinite(requestedVersion)) {
      return res.status(400).json({ message: "invalid api version" });
    }
    if (!versionPolicy.supportedVersions.includes(requestedVersion)) {
      return res.status(400).json({
        message: `unsupported api version ${requestedVersion}`,
        supportedVersions: versionPolicy.supportedVersions,
      });
    }

    req.apiVersion = requestedVersion;
    res.setHeader("x-api-version", String(requestedVersion));
    res.setHeader("x-api-latest-version", String(versionPolicy.latestVersion));
    const deprecation = versionPolicy.deprecations?.[String(requestedVersion)];
    if (deprecation) {
      res.setHeader("Deprecation", "true");
      res.setHeader("Sunset", `${deprecation.sunsetOn}T23:59:59Z`);
      res.setHeader("Link", `</docs/v${deprecation.successor}>; rel=\"successor-version\"`);
    }
    return next();
  });

  const config = app.get(ConfigService);

  if ((config.get<string>("NODE_ENV") ?? "") === "production") {
    try {
      execSync("pnpm -C packages/db prisma migrate diff --from-migrations --to-schema-datamodel --exit-code", {
        stdio: "inherit",
        env: process.env,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Schema mismatch detected. Run migrations before starting.");
      process.exit(1);
    }
  }

  const allowedOrigins = (config.get<string>("CORS_ORIGINS") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS blocked"), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
    new SanitizationPipe(),
  );

  const ops = app.get(OpsService);
  app.useGlobalFilters(new ObservabilityExceptionFilter(ops));

  const port = config.get<number>("PORT", 3001);

  const swaggerConfig = new DocumentBuilder()
    .setTitle("ERP API")
    .setDescription("ERP backend")
    .setVersion(`v${versionPolicy.defaultVersion}`)
    .addBearerAuth()
    .addApiKey(
      {
        type: "apiKey",
        name: "x-api-key",
        in: "header",
      },
      "developerApiKey",
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("/docs", app, document);

  for (const version of versionPolicy.supportedVersions) {
    const deprecation = versionPolicy.deprecations?.[String(version)];
    const versioned = {
      ...document,
      info: {
        ...document.info,
        title: `ERP API v${version}`,
        version: `v${version}`,
        description: deprecation
          ? `Deprecated on ${deprecation.deprecatedOn}. Sunset on ${deprecation.sunsetOn}.`
          : document.info.description,
      },
      "x-api-version": version,
      "x-supported-versions": versionPolicy.supportedVersions,
      "x-deprecation": deprecation ?? null,
    };
    SwaggerModule.setup(`/docs/v${version}`, app, versioned);
  }

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}`);
}

void bootstrap();
