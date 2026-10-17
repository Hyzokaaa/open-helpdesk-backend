import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { json } from "body-parser";
import { AppModule } from "./app.module";
import { ensureDatabase } from "./shared/infrastructure/ensure-database";
import { DataSource } from "typeorm";
import { DomainExceptionFilter } from "./shared/nest/filters/domain-exception.filter";
import { RejectNullCharactersPipe } from "./shared/nest/pipes/reject-null-characters.pipe";
import { AccessDeniedAuditRecorder } from "./audit-log/infrastructure/nest/access-denied-audit-recorder";
import { setupApiDocs } from "./api/infrastructure/nest/openapi/api-docs";
import { resolveBackendVersion } from "./config/infrastructure/nest/resolve-backend-version";
import { enableAppCors } from "./shared/infrastructure/nest/cors";

async function bootstrap() {
  await ensureDatabase();
  const app = await NestFactory.create(AppModule);

  // Register global JSON parser explicitly before the route-scoped one
  // (NestJS skips its default parser if it detects any 'jsonParser' middleware)
  (app as any).useBodyParser("json", { limit: "50mb" });
  app.use("/inbound/email", json({ limit: "25mb" }));

  app.useGlobalPipes(
    new RejectNullCharactersPipe(),
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter(new AccessDeniedAuditRecorder(app.get(DataSource))));

  enableAppCors(app);

  // Public API document at /api/v1/openapi.json; /docs and /api/v1/docs redirect to the web app's /docs page
  setupApiDocs(app, {
    version: resolveBackendVersion(),
    serverUrl: process.env.API_URL,
    frontendUrl: process.env.FRONTEND_URL,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
