import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerPort } from '@common/logger';
import { loadLoggerConfig } from './logger.config';
import { TaggedLoggerAdapter } from './tagged-logger.adapter';
import { loggerRegistry } from './logger.registry';
import { NestLoggerBridge } from './nest-logger.bridge';
import { RequestIdMiddleware } from './request-id.middleware';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

@Global()
@Module({
  providers: [
    {
      provide: LoggerPort,
      useFactory: () =>
        loggerRegistry.getOrCreate(
          [],
          () => new TaggedLoggerAdapter(loadLoggerConfig()),
        ),
    },
    {
      provide: NestLoggerBridge,
      useFactory: (logger: LoggerPort) => new NestLoggerBridge(logger),
      inject: [LoggerPort],
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
  exports: [LoggerPort, NestLoggerBridge],
})
export class LoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
