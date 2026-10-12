import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { REDIS_CONNECTION } from '@infrastructure/queue/redis.provider';
import { CheckSchedulerPort } from '@modules/provider/domain/check-scheduler.port';

export const BALANCE_CHECK_QUEUE = 'balance-checks';
export const CHECK_JOB = 'check';
export const CLEANUP_JOB = 'cleanup';
/** 1 lần chính + 2 lần thử lại khi lỗi mạng tạm thời. */
export const CHECK_ATTEMPTS = 3;
/** Thời gian chờ trước lần thử lại thứ 1 và thứ 2. */
export const RETRY_DELAYS_MS = [5_000, 15_000];

const CLEANUP_SCHEDULER_ID = 'cleanup-balance-checks';
const CLEANUP_CRON = '15 3 * * *';

export interface CheckJobData {
  providerId: string;
}

const schedulerId = (providerId: string) => `provider-${providerId}`;

/** Lịch quét định kỳ bằng BullMQ Job Scheduler: mỗi đối tác một lịch, lưu trong Redis. */
@Injectable()
export class BullmqCheckScheduler
  extends CheckSchedulerPort
  implements OnApplicationShutdown
{
  private readonly queue: Queue;

  constructor(@Inject(REDIS_CONNECTION) redis: Redis) {
    super();
    this.queue = new Queue(BALANCE_CHECK_QUEUE, { connection: redis });
  }

  async schedule(providerId: string, intervalMinutes: number): Promise<void> {
    await this.queue.upsertJobScheduler(
      schedulerId(providerId),
      { every: intervalMinutes * 60_000 },
      {
        name: CHECK_JOB,
        data: { providerId } satisfies CheckJobData,
        opts: {
          attempts: CHECK_ATTEMPTS,
          backoff: { type: 'custom' },
          removeOnComplete: 50,
          removeOnFail: 200,
        },
      },
    );
  }

  async unschedule(providerId: string): Promise<void> {
    await this.queue.removeJobScheduler(schedulerId(providerId));
  }

  /** Chỉ tạo / sửa lịch khi chưa có hoặc chu kỳ khác, để khởi động lại worker không dồn lời gọi. */
  async ensure(providerId: string, intervalMinutes: number): Promise<void> {
    const existing = await this.queue.getJobScheduler(schedulerId(providerId));
    if (existing?.every === intervalMinutes * 60_000) return;
    await this.schedule(providerId, intervalMinutes);
  }

  async ensureCleanup(): Promise<void> {
    await this.queue.upsertJobScheduler(
      CLEANUP_SCHEDULER_ID,
      { pattern: CLEANUP_CRON },
      {
        name: CLEANUP_JOB,
        opts: { removeOnComplete: 10, removeOnFail: 50 },
      },
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close().catch(() => undefined);
  }
}
