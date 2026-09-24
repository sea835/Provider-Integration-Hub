import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { LoggerPort, LogLayer } from '@common/logger';

/** Log mỗi HTTP request: [HTTP][UserController] GET /users 200 12ms */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
    private readonly logger: LoggerPort;

    constructor(logger: LoggerPort) {
        this.logger = logger.child(LogLayer.PRESENTATION);
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== 'http') return next.handle();

        const http = context.switchToHttp();
        const req = http.getRequest<Request>();
        const res = http.getResponse<Response>();
        const logger = this.logger.child(context.getClass().name);
        const startedAt = Date.now();

        return next.handle().pipe(
            tap({
                next: () => {
                    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
                },
                error: (err: any) => {
                    const status = err?.status ?? err?.getStatus?.() ?? 500;
                    const msg = `${req.method} ${req.originalUrl} ${status} ${Date.now() - startedAt}ms`;
                    // stack của lỗi 5xx đã được Nest ExceptionsHandler log qua NestLoggerBridge, ở đây chỉ ghi access log
                    if (status >= 500) logger.error(msg);
                    else logger.warn(msg, { reason: err?.message });
                },
            }),
        );
    }
}
