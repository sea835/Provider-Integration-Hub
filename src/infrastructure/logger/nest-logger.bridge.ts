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

    log(message: any, ...params: any[]) {
        this.scoped(params).info(String(message));
    }

    error(message: any, ...params: any[]) {
        // Nest gọi error(message, stack?, context?)
        const context = this.extractContext(params);
        const stack = typeof params[0] === 'string' ? params[0] : undefined;
        const err = message instanceof Error ? message : stack ? Object.assign(new Error(String(message)), { stack }) : undefined;
        this.root.child(...context).error(String(message instanceof Error ? message.message : message), err);
    }

    warn(message: any, ...params: any[]) {
        this.scoped(params).warn(String(message));
    }

    debug(message: any, ...params: any[]) {
        this.scoped(params).debug(String(message));
    }

    verbose(message: any, ...params: any[]) {
        this.scoped(params).verbose(String(message));
    }

    private scoped(params: any[]): LoggerPort {
        return this.root.child(...this.extractContext(params));
    }

    private extractContext(params: any[]): string[] {
        const last = params[params.length - 1];
        return typeof last === 'string' && params.length > 0 && !last.includes('\n') ? [last] : [];
    }
}
