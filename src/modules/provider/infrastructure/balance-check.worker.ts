import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { LoggerPort, LogLayer } from '@common/logger';
import { REDIS_CONNECTION } from '@infrastructure/queue/redis.provider';
import { BalanceCheckService } from '@modules/provider/application/balance-check.service';
import { ProviderRepositoryPort } from '@modules/provider/domain/provider.repository.port';
import {
  BALANCE_CHECK_QUEUE,
  BullmqCheckScheduler,
  CHECK_ATTEMPTS,
  CheckJobData,
  CLEANUP_JOB,
  RETRY_DELAYS_MS,
} from '@modules/provider/infrastructure/balance-check.queue';

const CONCURRENCY = 5;

/** Lỗi mạng tạm thời: ném ra để BullMQ thử lại theo RETRY_DELAYS_MS. */
class TransientCheckError extends Error {}

/** Worker BullMQ chạy trong tiến trình `worker`: quét số dư theo lịch và dọn lịch sử cũ. */
@Injectable()
export class BalanceCheckWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger: LoggerPort;
  private worker?: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    private readonly checks: BalanceCheckService,
    private readonly providers: ProviderRepositoryPort,
    private readonly scheduler: BullmqCheckScheduler,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.INFRASTRUCTURE,
      'Provider',
      BalanceCheckWorker.name,
    );
  }

  async onModuleInit(): Promise<void> {
    this.worker = new Worker(
      BALANCE_CHECK_QUEUE,
      (job: Job) => this.process(job),
      {
        connection: this.redis,
        concurrency: CONCURRENCY,
        settings: {
          backoffStrategy: (attemptsMade: number) =>
            RETRY_DELAYS_MS[Math.min(attemptsMade, RETRY_DELAYS_MS.length) - 1],
        },
      },
    );
    this.worker.on('failed', (job, error) => {
      if (error instanceof TransientCheckError) return;
      this.logger.error('Job kiểm tra số dư lỗi', error, {
        jobId: job?.id,
        name: job?.name,
      });
    });

    const active = await this.providers.listActive();
    for (const provider of active) {
      await this.scheduler.ensure(provider.id, provider.intervalMinutes);
    }
    await this.scheduler.ensureCleanup();
    this.logger.info('Worker kiểm tra số dư đã sẵn sàng', {
      activeProviders: active.length,
    });
  }

  private async process(job: Job): Promise<void> {
    if (job.name === CLEANUP_JOB) {
      await this.checks.cleanup();
      return;
    }
    const { providerId } = job.data as CheckJobData;
    const lastAttempt = job.attemptsMade >= CHECK_ATTEMPTS - 1;
    const outcome = await this.checks.runScheduled(providerId, !lastAttempt);
    if (outcome === 'RETRY') {
      throw new TransientCheckError('Lỗi mạng tạm thời, sẽ thử lại');
    }
    if (outcome === 'GONE') await this.scheduler.unschedule(providerId);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close().catch(() => undefined);
  }
}
