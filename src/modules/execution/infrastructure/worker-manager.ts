import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DelayedError, Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { LoggerPort, LogLayer } from '@common/logger';
import { REDIS_CONNECTION } from '@infrastructure/queue/redis.provider';
import {
  JobName,
  OrderJobData,
  supplierQueueName,
  SWEEPER_SCHEDULER_ID,
  SYSTEM_QUEUE,
} from '@infrastructure/queue/queue-names';
import { SupplierConfigService } from '@modules/supplier/application/supplier-config.service';
import { SupplierEventsPort } from '@modules/supplier/domain/supplier-events.port';
import { SupplierStatus } from '@modules/supplier/domain/supplier-status';
import { SupplierRuntimeInfo } from '@modules/supplier/domain/supplier-config';
import { SubmitProcessor } from '@modules/execution/application/submit.processor';
import { CheckProcessor } from '@modules/execution/application/check.processor';
import { SweeperService } from '@modules/execution/application/sweeper.service';
import {
  DONE,
  ProcessOutcome,
} from '@modules/execution/application/process-outcome';

const RECONCILE_INTERVAL_MS = 30_000;
const SWEEP_INTERVAL_MS = 60_000;

interface ManagedWorker {
  worker: Worker<OrderJobData>;
  connection: Redis;
  version: number;
}

/**
 * Một BullMQ Worker cho mỗi NCC. Đọc cấu hình từ DB khi khởi động, khi nhận
 * sự kiện `supplier.changed` và mỗi 30s: tạo mới / tạo lại khi đổi version /
 * pause khi PAUSED / đóng khi DISABLED. Đổi cấu hình không cần restart.
 */
@Injectable()
export class WorkerManager
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger: LoggerPort;
  private readonly workers = new Map<string, ManagedWorker>();
  private reconciling: Promise<void> = Promise.resolve();
  private timer?: NodeJS.Timeout;
  private systemQueue?: Queue;
  private systemWorker?: Worker;
  private systemConnection?: Redis;
  private stopped = false;

  constructor(
    private readonly configs: SupplierConfigService,
    private readonly events: SupplierEventsPort,
    private readonly submit: SubmitProcessor,
    private readonly check: CheckProcessor,
    private readonly sweeper: SweeperService,
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.INFRASTRUCTURE,
      'Execution',
      WorkerManager.name,
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.reconcile();
    this.events.onChanged(() => void this.reconcile());
    this.timer = setInterval(
      () => void this.reconcile(),
      RECONCILE_INTERVAL_MS,
    );
    await this.startSystemWorker();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.reconciling;
    await Promise.allSettled(
      [...this.workers.entries()].map(([code, managed]) =>
        this.stopWorker(code, managed),
      ),
    );
    await this.systemWorker?.close();
    await this.systemQueue?.close();
    await this.systemConnection?.quit().catch(() => undefined);
  }

  /** Chạy tuần tự để hai lần reconcile không chồng nhau. */
  reconcile(): Promise<void> {
    this.reconciling = this.reconciling
      .then(() => (this.stopped ? undefined : this.doReconcile()))
      .catch((error: unknown) => {
        this.logger.error('Reconcile worker lỗi', error);
      });
    return this.reconciling;
  }

  private async doReconcile(): Promise<void> {
    const suppliers = await this.configs.listRuntime();
    for (const supplier of suppliers) {
      const current = this.workers.get(supplier.code);

      if (supplier.status === SupplierStatus.DISABLED) {
        if (current) await this.stopWorker(supplier.code, current);
        continue;
      }

      if (!current || current.version !== supplier.version) {
        if (current) await this.stopWorker(supplier.code, current);
        this.workers.set(supplier.code, this.startWorker(supplier));
      }

      const { worker } = this.workers.get(supplier.code)!;
      if (supplier.status === SupplierStatus.PAUSED && !worker.isPaused()) {
        await worker.pause();
        this.logger.info('Tạm dừng worker', { supplier: supplier.code });
      } else if (
        supplier.status === SupplierStatus.ACTIVE &&
        worker.isPaused()
      ) {
        worker.resume();
        this.logger.info('Chạy lại worker', { supplier: supplier.code });
      }
    }
  }

  private startWorker(supplier: SupplierRuntimeInfo): ManagedWorker {
    const connection = this.redis.duplicate();
    const worker = new Worker<OrderJobData>(
      supplierQueueName(supplier.code),
      (job, token) => this.process(job, token),
      {
        connection,
        concurrency: supplier.concurrency,
        limiter: { max: supplier.rateLimitPerMin, duration: 60_000 },
      },
    );
    worker.on('failed', (job, error) => {
      this.logger.error('Job lỗi, Sweeper sẽ enqueue lại', error, {
        supplier: supplier.code,
        jobId: job?.id,
      });
    });
    worker.on('error', (error) => {
      this.logger.error('Worker lỗi', error, { supplier: supplier.code });
    });

    this.logger.info('Khởi động worker', {
      supplier: supplier.code,
      version: supplier.version,
      concurrency: supplier.concurrency,
      rateLimitPerMin: supplier.rateLimitPerMin,
    });
    return { worker, connection, version: supplier.version };
  }

  private async stopWorker(
    code: string,
    managed: ManagedWorker,
  ): Promise<void> {
    await managed.worker.close();
    await managed.connection.quit().catch(() => undefined);
    this.workers.delete(code);
    this.logger.info('Dừng worker', {
      supplier: code,
      version: managed.version,
    });
  }

  private async process(job: Job<OrderJobData>, token?: string): Promise<void> {
    let outcome: ProcessOutcome = DONE;
    if (job.name === JobName.SUBMIT) {
      outcome = await this.submit.handle(job.data.transCode);
    } else if (job.name === JobName.CHECK) {
      outcome = await this.check.handle(job.data.transCode);
    }

    if (outcome.kind === 'DELAY') {
      await job.moveToDelayed(Date.now() + outcome.delayMs, token);
      throw new DelayedError();
    }
  }

  private async startSystemWorker(): Promise<void> {
    this.systemQueue = new Queue(SYSTEM_QUEUE, { connection: this.redis });
    this.systemQueue.on('error', (error) => {
      if (!this.stopped) this.logger.error('System queue lỗi', error);
    });
    await this.systemQueue.upsertJobScheduler(
      SWEEPER_SCHEDULER_ID,
      { every: SWEEP_INTERVAL_MS },
      { name: JobName.SWEEP },
    );

    this.systemConnection = this.redis.duplicate();
    this.systemWorker = new Worker(
      SYSTEM_QUEUE,
      async (job) => {
        if (job.name === JobName.SWEEP) await this.sweeper.run();
      },
      { connection: this.systemConnection, concurrency: 1 },
    );
    this.systemWorker.on('error', (error) => {
      this.logger.error('System worker lỗi', error);
    });
  }
}
