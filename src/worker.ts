import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { WorkerModule } from '@/worker.module';
import { NestLoggerBridge } from '@infrastructure/logger/nest-logger.bridge';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(NestLoggerBridge));
  app.enableShutdownHooks();
}
void bootstrap();
