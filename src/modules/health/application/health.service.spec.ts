import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from '@modules/health/application/health.service';
import { DatabaseHealthPort } from '@modules/health/domain/database-health.port';
import { LoggerPort } from '@common/logger';

describe('HealthService', () => {
  let service: HealthService;
  let databaseHealth: Record<string, jest.Mock>;
  let logger: Record<string, jest.Mock>;

  beforeEach(() => {
    databaseHealth = { ping: jest.fn() };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn().mockReturnThis(),
    };

    service = new HealthService(
      databaseHealth as unknown as DatabaseHealthPort,
      logger as unknown as LoggerPort,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getLiveness', () => {
    it('nên trả về ok mà không gọi database', () => {
      const result = service.getLiveness();

      expect(result.status).toBe('ok');
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(databaseHealth.ping).not.toHaveBeenCalled();
    });
  });

  describe('checkReadiness', () => {
    it('nên trả về ok khi database phản hồi', async () => {
      databaseHealth.ping.mockResolvedValue(undefined);

      const result = await service.checkReadiness();

      expect(result.status).toBe('ok');
      expect(result.checks.database.status).toBe('up');
    });

    it('nên ném ServiceUnavailableException và ghi log khi database lỗi', async () => {
      databaseHealth.ping.mockRejectedValue(new Error('connection refused'));

      await expect(service.checkReadiness()).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(logger.warn).toHaveBeenCalledWith('Database health check failed', {
        reason: 'connection refused',
      });
    });

    it('nên ghi cả lỗi gốc của driver khi Drizzle bọc lỗi trong cause', async () => {
      databaseHealth.ping.mockRejectedValue(
        new Error('Failed query: select 1', {
          cause: new Error('connect ECONNREFUSED 127.0.0.1:5432'),
        }),
      );

      await expect(service.checkReadiness()).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(logger.warn).toHaveBeenCalledWith('Database health check failed', {
        reason: 'Failed query: select 1',
        cause: 'connect ECONNREFUSED 127.0.0.1:5432',
      });
    });

    it('không trả lý do lỗi database ra response', async () => {
      databaseHealth.ping.mockRejectedValue(
        new Error('password authentication failed for user "postgres"'),
      );

      const error = await service.checkReadiness().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(
        JSON.stringify((error as ServiceUnavailableException).getResponse()),
      ).not.toContain('password authentication failed');
    });

    it('nên ném ServiceUnavailableException khi database không phản hồi trong thời hạn', async () => {
      jest.useFakeTimers();
      databaseHealth.ping.mockReturnValue(new Promise(() => undefined));

      const readiness = service.checkReadiness();
      const assertion = expect(readiness).rejects.toThrow(
        ServiceUnavailableException,
      );
      await jest.advanceTimersByTimeAsync(HealthService.DATABASE_TIMEOUT_MS);

      await assertion;
    });
  });
});
