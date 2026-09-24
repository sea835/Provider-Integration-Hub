import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerPort, LogLayer } from '@common/logger';
import { RequestContext } from '@infrastructure/logger/request-context';
import { ApiErrorResponse } from '@common/filters/error-response.interface';

interface DatabaseError extends Error {
  code?: string;
  detail?: string;
  table?: string;
  constraint?: string;
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger?: LoggerPort;

  constructor(@Optional() logger?: LoggerPort) {
    if (logger) {
      this.logger = logger.child(LogLayer.SYSTEM, 'GlobalExceptionFilter');
    }
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      RequestContext.requestId || request.header('x-request-id');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorName = 'Internal Server Error';
    let message: string | string[] = 'Internal server error occurred';
    let details: unknown = undefined;

    // 1. NestJS Standard HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        errorName = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string | string[]) || exception.message;
        errorName =
          (resObj.error as string) ||
          exception.name.replace('Exception', '').trim() ||
          'Http Error';
        if (resObj.details) {
          details = resObj.details;
        }
      }
    }
    // 2. PostgreSQL / Drizzle Database Errors (hỗ trợ cả pg driver và DrizzleQueryError wrap trong cause)
    else if (this.extractDatabaseError(exception)) {
      const dbErr = this.extractDatabaseError(exception)!;
      switch (dbErr.code) {
        case '23505': // unique_violation
          status = HttpStatus.CONFLICT;
          errorName = 'Conflict';
          message = this.parseUniqueConstraintMessage(dbErr);
          break;
        case '23503': // foreign_key_violation
          status = HttpStatus.BAD_REQUEST;
          errorName = 'Bad Request';
          message = 'Tham chiếu dữ liệu không tồn tại hoặc không hợp lệ';
          break;
        case '22P02': // invalid_text_representation (ví dụ UUID sai format)
          status = HttpStatus.BAD_REQUEST;
          errorName = 'Bad Request';
          message = 'Định dạng dữ liệu đầu vào không hợp lệ';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          errorName = 'Database Error';
          message = 'Lỗi truy vấn cơ sở dữ liệu';
          break;
      }
    }
    // 3. Unhandled Standard Errors
    else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorName = exception.name || 'Internal Server Error';
      message =
        process.env.NODE_ENV === 'production'
          ? 'Internal server error occurred'
          : exception.message;
    }

    // Ghi log
    if (this.logger) {
      const statusCode = Number(status);
      const logMessage = `[${request.method}] ${request.originalUrl || request.url} - ${statusCode} ${errorName}`;
      if (statusCode >= 500) {
        this.logger.error(logMessage, exception, {
          requestId,
          path: request.url,
          method: request.method,
          body: request.body,
        });
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage, {
          requestId,
          status: statusCode,
          message,
          path: request.url,
        });
      }
    }

    const errorResponse: ApiErrorResponse = {
      statusCode: status,
      error: errorName,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      ...(requestId ? { requestId } : {}),
    };

    response.status(status).json(errorResponse);
  }

  private extractDatabaseError(err: unknown): DatabaseError | null {
    if (err === null || typeof err !== 'object') return null;

    const candidate = err as Record<string, unknown>;
    if (typeof candidate.code === 'string') {
      return candidate as unknown as DatabaseError;
    }

    if (
      candidate.cause &&
      typeof candidate.cause === 'object' &&
      typeof (candidate.cause as Record<string, unknown>).code === 'string'
    ) {
      return candidate.cause as unknown as DatabaseError;
    }

    return null;
  }

  private parseUniqueConstraintMessage(err: DatabaseError): string {
    if (err.detail) {
      const match = err.detail.match(/Key \((.+?)\)=\((.+?)\) already exists/);
      if (match) {
        return `Giá trị '${match[2]}' của trường '${match[1]}' đã tồn tại trong hệ thống`;
      }
      return err.detail;
    }
    return 'Dữ liệu đã tồn tại trong hệ thống (trùng lặp khóa duy nhất)';
  }
}
