import * as dotenv from 'dotenv';
dotenv.config();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { NestLoggerBridge } from '@infrastructure/logger/nest-logger.bridge';
import { NestExpressApplication } from '@nestjs/platform-express';

/** TRUST_PROXY: số hop (vd `1`), `true`, hoặc danh sách IP/subnet của proxy. */
function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const hops = Number(value);
  return Number.isInteger(hops) ? hops : value;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(NestLoggerBridge));
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
  }
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors();
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Provider Integration Hub API')
    .setDescription(
      'API documentation for Provider Integration Hub (DDD Hexagonal)',
    )
    .setVersion('1.0')
    .addTag('users')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
