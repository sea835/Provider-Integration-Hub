import { LoggerService } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';

/**
 * Bridge để log nội bộ của Nest (bootstrap, route mapping, exception filter...)
 * cũng đi qua cùng adapter, cùng format tag: [SYS][RoutesResolver] ...
 */
export class NestLoggerBridge implements LoggerService {
  private readonly root: LoggerPort;

  constructor(logger: LoggerPort) {
    this.root = logger.child(LogLayer.SYSTEM);
  }

  log(message: unknown, ...params: unknown[]) {
    this.scoped(params).info(String(message));
  }

  error(message: unknown, ...params: unknown[]) {
    // Nest gọi error(message, stack?, context?)
    const context = this.extractContext(params);
    const stack = typeof params[0] === 'string' ? params[0] : undefined;
    const err =
      message instanceof Error
        ? message
        : stack
          ? Object.assign(new Error(String(message)), { stack })
          : undefined;
    this.root
      .child(...context)
      .error(String(message instanceof Error ? message.message : message), err);
  }

  warn(message: unknown, ...params: unknown[]) {
    this.scoped(params).warn(String(message));
  }

  debug(message: unknown, ...params: unknown[]) {
    this.scoped(params).debug(String(message));
  }

  verbose(message: unknown, ...params: unknown[]) {
    this.scoped(params).verbose(String(message));
  }

  private scoped(params: unknown[]): LoggerPort {
    return this.root.child(...this.extractContext(params));
  }

  private extractContext(params: unknown[]): string[] {
    const last: unknown =
      params.length > 0 ? params[params.length - 1] : undefined;
    return typeof last === 'string' && !last.includes('\n') ? [last] : [];
  }
}
