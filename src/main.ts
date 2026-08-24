import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { json } from "body-parser";
import { AppModule } from "./app.module";
import { ensureDatabase } from "./shared/infrastructure/ensure-database";
import { DomainExceptionFilter } from "./shared/nest/filters/domain-exception.filter";

async function bootstrap() {
  await ensureDatabase();
  const app = await NestFactory.create(AppModule);

  // Register global JSON parser explicitly before the route-scoped one
  // (NestJS skips its default parser if it detects any 'jsonParser' middleware)
  (app as any).useBodyParser("json", { limit: "50mb" });
  app.use("/inbound/email", json({ limit: "25mb" }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter());

  const corsOrigins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL;
  const allowedOrigins = corsOrigins
    ? corsOrigins.split(",").map((u) => u.trim())
    : ["http://localhost:5173"];

  const verifiedDomainCache = new Map<string, boolean>();
  let cacheExpiry = 0;

  app.enableCors({
    origin: async (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);

      try {
        const now = Date.now();
        if (now > cacheExpiry) {
          verifiedDomainCache.clear();
          cacheExpiry = now + 60_000;
        }

        const host = new URL(origin).hostname;
        if (verifiedDomainCache.has(host)) return callback(null, verifiedDomainCache.get(host));

        const { TypeOrmWorkspaceRepository } = await import("./workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository");
        const repo = app.get(TypeOrmWorkspaceRepository);
        const workspaces = await repo.findByCustomDomain(host);
        const allowed = workspaces.some((w) => w.customDomainVerified);
        verifiedDomainCache.set(host, allowed);
        callback(null, allowed);
      } catch {
        callback(null, false);
      }
    },
    exposedHeaders: ["X-Unread-Count", "Date"],
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
