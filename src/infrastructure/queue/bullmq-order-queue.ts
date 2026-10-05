import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { LoggerPort, LogLayer } from '@common/logger';
import { OrderQueuePort } from '@modules/transaction/domain/order-queue.port';
import { REDIS_CONNECTION } from '@infrastructure/queue/redis.provider';
import {
  JobName,
  OrderJobData,
  supplierQueueName,
} from '@infrastructure/queue/queue-names';

const FINISHED_STATES = new Set(['completed', 'failed']);

/**
 * Mỗi NCC một queue. jobId = `${transCode}-submit|check-${lần}` để enqueue trùng
 * không tạo job mới; job cùng id đã xong/fail thì được thay (Sweeper cần enqueue lại).
 * `attempts: 1`: retry do máy trạng thái quyết định, không để BullMQ tự retry.
 */
@Injectable()
export class BullmqOrderQueue
  extends OrderQueuePort
  implements OnApplicationShutdown
{
  private readonly queues = new Map<string, Queue<OrderJobData>>();
  private readonly logger: LoggerPort;
  private closing = false;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    logger: LoggerPort,
  ) {
    super();
    this.logger = logger.child(
      LogLayer.INFRASTRUCTURE,
      'Queue',
      BullmqOrderQueue.name,
    );
  }

  enqueueSubmit(
    supplierCode: string,
    transCode: string,
    attempt: number,
  ): Promise<void> {
    return this.addUnique(
      supplierCode,
      JobName.SUBMIT,
      transCode,
      `${transCode}-submit-${attempt}`,
      0,
    );
  }

  enqueueCheck(
    supplierCode: string,
    transCode: string,
    attempt: number,
    delayMs: number,
  ): Promise<void> {
    return this.addUnique(
      supplierCode,
      JobName.CHECK,
      transCode,
      `${transCode}-check-${attempt}`,
      delayMs,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    this.closing = true;
    await Promise.allSettled([...this.queues.values()].map((q) => q.close()));
  }

  private async addUnique(
    supplierCode: string,
    name: string,
    transCode: string,
    jobId: string,
    delayMs: number,
  ): Promise<void> {
    const queue = this.queue(supplierCode);
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'delayed' && delayMs <= 0) {
        await existing.promote().catch(() => undefined);
        return;
      }
      if (!FINISHED_STATES.has(state)) return;
      await existing.remove();
    }
    await queue.add(
      name,
      { transCode },
      {
        jobId,
        delay: Math.max(0, delayMs),
        attempts: 1,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }

  private queue(supplierCode: string): Queue<OrderJobData> {
    let queue = this.queues.get(supplierCode);
    if (!queue) {
      queue = new Queue<OrderJobData>(supplierQueueName(supplierCode), {
        connection: this.redis,
      });
      queue.on('error', (error) => {
        if (!this.closing) {
          this.logger.error('Queue lỗi kết nối Redis', error, {
            supplier: supplierCode,
          });
        }
      });
      this.queues.set(supplierCode, queue);
    }
    return queue;
  }
}
