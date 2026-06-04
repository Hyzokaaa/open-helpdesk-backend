import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'body-parser';
import { AppModule } from './app.module';
import { ensureDatabase } from './shared/infrastructure/ensure-database';
import { DomainExceptionFilter } from './shared/nest/filters/domain-exception.filter';

async function bootstrap() {
  await ensureDatabase();
  const app = await NestFactory.create(AppModule);

  // Register global JSON parser explicitly before the route-scoped one
  // (NestJS skips its default parser if it detects any 'jsonParser' middleware)
  (app as any).useBodyParser('json');
  app.use('/inbound/email', json({ limit: '25mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter());

  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: frontendUrl || true,
    exposedHeaders: ['X-Unread-Count', 'Date'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
