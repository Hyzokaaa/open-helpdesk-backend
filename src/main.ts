import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ensureDatabase } from './shared/infrastructure/ensure-database';
import { DomainExceptionFilter } from './shared/nest/filters/domain-exception.filter';

async function bootstrap() {
  await ensureDatabase();
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter());

  app.enableCors({
    exposedHeaders: ['X-Unread-Count', 'Date'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
