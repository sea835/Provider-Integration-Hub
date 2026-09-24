import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { DatabaseHealthPort } from '@modules/health/domain/database-health.port';

export interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs: number;
}

export interface LivenessResult {
  status: 'ok';
  uptimeSeconds: number;
}

export interface ReadinessResult {
  status: 'ok';
  checks: { database: DependencyCheck };
}

@Injectable()
export class HealthService {
  /** Probe của orchestrator thường timeout sau vài giây, không chờ tới timeout kết nối của pool (5s) */
  static readonly DATABASE_TIMEOUT_MS = 3000;

  private readonly logger: LoggerPort;

  constructor(
    private readonly databaseHealth: DatabaseHealthPort,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Health',
      HealthService.name,
    );
  }

  /** Liveness: tiến trình còn sống, không kiểm tra phụ thuộc bên ngoài */
  getLiveness(): LivenessResult {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
  }

  /** Readiness: sẵn sàng nhận traffic. Ném 503 nếu database không phản hồi */
  async checkReadiness(): Promise<ReadinessResult> {
    const database = await this.checkDatabase();

    if (database.status === 'down') {
      throw new ServiceUnavailableException({
        error: 'Service Unavailable',
        message: 'Hệ thống chưa sẵn sàng: database không phản hồi',
        details: { database },
      });
    }

    return { status: 'ok', checks: { database } };
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    const startedAt = Date.now();
    try {
      await this.withTimeout(
        this.databaseHealth.ping(),
        HealthService.DATABASE_TIMEOUT_MS,
      );
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (err) {
      // Lý do lỗi chỉ ghi log, không trả ra response public.
      // Drizzle bọc lỗi của driver (ECONNREFUSED, sai mật khẩu...) trong `cause`.
      const cause = err instanceof Error ? err.cause : undefined;
      this.logger.warn('Database health check failed', {
        reason: err instanceof Error ? err.message : String(err),
        ...(cause instanceof Error
          ? { cause: cause.message || cause.name }
          : {}),
      });
      return { status: 'down', latencyMs: Date.now() - startedAt };
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Timed out after ${ms}ms`)),
        ms,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
