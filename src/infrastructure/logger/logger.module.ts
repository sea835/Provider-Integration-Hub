import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerPort } from '@common/logger';
import { loadLoggerConfig } from '@infrastructure/logger/logger.config';
import { TaggedLoggerAdapter } from '@infrastructure/logger/tagged-logger.adapter';
import { loggerRegistry } from '@infrastructure/logger/logger.registry';
import { NestLoggerBridge } from '@infrastructure/logger/nest-logger.bridge';
import { RequestIdMiddleware } from '@infrastructure/logger/request-id.middleware';
import { HttpLoggingInterceptor } from '@infrastructure/logger/http-logging.interceptor';

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
