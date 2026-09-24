import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestLoggerBridge } from '@infrastructure/logger/nest-logger.bridge';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(NestLoggerBridge));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
