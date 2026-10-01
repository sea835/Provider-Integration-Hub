import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { LoggerPort } from '@common/logger';
import { DomainError, DomainErrorKind } from '@common/errors/domain-error';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockLogger: Record<string, jest.Mock>;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockRequest: {
    url: string;
    originalUrl: string;
    method: string;
    header: jest.Mock;
    body: Record<string, unknown>;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    mockLogger = {
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/test-route',
      originalUrl: '/test-route',
      method: 'GET',
      header: jest.fn().mockReturnValue('req-12345'),
      body: {},
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    filter = new GlobalExceptionFilter(mockLogger as unknown as LoggerPort);
  });

  it.each([
    [DomainErrorKind.VALIDATION, HttpStatus.BAD_REQUEST],
    [DomainErrorKind.UNAUTHORIZED, HttpStatus.UNAUTHORIZED],
    [DomainErrorKind.FORBIDDEN, HttpStatus.FORBIDDEN],
    [DomainErrorKind.NOT_FOUND, HttpStatus.NOT_FOUND],
    [DomainErrorKind.CONFLICT, HttpStatus.CONFLICT],
    [DomainErrorKind.UNPROCESSABLE, HttpStatus.UNPROCESSABLE_ENTITY],
  ])('DomainError kind %s → HTTP %s, error = mã nghiệp vụ', (kind, status) => {
    class SampleError extends DomainError {
      readonly code = 'ERR_SAMPLE';
      readonly kind = kind;
    }

    filter.catch(new SampleError('Thông điệp nghiệp vụ'), mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(status);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: status,
        error: 'ERR_SAMPLE',
        message: 'Thông điệp nghiệp vụ',
      }),
    );
  });

  it('không log secret trong body khi lỗi 5xx', () => {
    mockRequest.body = { name: 'x', secrets: { apiKey: 'top-secret' } };

    filter.catch(new Error('boom'), mockHost);

    const call = mockLogger.error.mock.calls[0] as unknown[];
    const meta = call[2] as { body: unknown };
    expect(JSON.stringify(meta.body)).not.toContain('top-secret');
  });

  it('nên xử lý NotFoundException chuẩn xác', () => {
    const exception = new NotFoundException('User not found');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'User not found',
        path: '/test-route',
        requestId: 'req-12345',
      }),
    );
  });

  it('nên xử lý BadRequestException với mảng validation errors từ ValidationPipe', () => {
    const validationMessages = [
      'email must be an email',
      'password is too short',
    ];
    const exception = new BadRequestException({
      message: validationMessages,
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: validationMessages,
        path: '/test-route',
      }),
    );
  });

  it('nên xử lý lỗi PostgreSQL 23505 (unique_violation) thành 409 Conflict', () => {
    const dbError = new Error('duplicate key value violates unique constraint');
    Object.assign(dbError, {
      code: '23505',
      detail: 'Key (email)=(test@example.com) already exists.',
    });

    filter.catch(dbError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message:
          "Giá trị 'test@example.com' của trường 'email' đã tồn tại trong hệ thống",
        path: '/test-route',
      }),
    );
  });

  it('nên xử lý lỗi PostgreSQL 23503 (foreign_key_violation) thành 400 Bad Request', () => {
    const dbError = new Error('foreign key constraint failure');
    Object.assign(dbError, {
      code: '23503',
    });

    filter.catch(dbError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Tham chiếu dữ liệu không tồn tại hoặc không hợp lệ',
      }),
    );
  });

  it('nên xử lý lỗi 500 Unhandled Error và ghi log error', () => {
    const error = new Error('Unexpected database failure');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Error',
      }),
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
