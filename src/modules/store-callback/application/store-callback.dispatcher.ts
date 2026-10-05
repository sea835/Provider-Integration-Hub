import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { StoreCallbackRepositoryPort } from '@modules/transaction/domain/store-callback';
import { StoreCallbackService } from '@modules/store-callback/application/store-callback.service';
import { STORE_CALLBACK_TIMEOUT_MS } from '@modules/store-callback/application/store-callback-sender';

const DEFAULT_POLL_MS = 2_000;
const BATCH_SIZE = 20;
const LEASE_MS = STORE_CALLBACK_TIMEOUT_MS + 50_000;

/**
 * Chạy trong process worker: định kỳ nhận callback đến hạn trong outbox và gửi về Store.
 * Nhiều process chạy song song vẫn không gửi trùng nhờ FOR UPDATE SKIP LOCKED + lease.
 */
@Injectable()
export class StoreCallbackDispatcher
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger: LoggerPort;
  private timer?: NodeJS.Timeout;
  private running: Promise<number> | null = null;
  private stopped = false;

  constructor(
    private readonly callbacks: StoreCallbackRepositoryPort,
    private readonly service: StoreCallbackService,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'StoreCallback',
      StoreCallbackDispatcher.name,
    );
  }

  onApplicationBootstrap(): void {
    const pollMs =
      Number(process.env.STORE_CALLBACK_POLL_MS) || DEFAULT_POLL_MS;
    this.timer = setInterval(() => void this.runOnce(), pollMs);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  /** Một lượt gửi; trả số callback đã xử lý. Không chạy chồng lượt. */
  runOnce(): Promise<number> {
    if (this.stopped) return Promise.resolve(0);
    if (this.running) return this.running;
    this.running = this.dispatch()
      .catch((error: unknown) => {
        if (!this.stopped)
          this.logger.error('Gửi callback về Store lỗi', error);
        return 0;
      })
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  private async dispatch(): Promise<number> {
    const due = await this.callbacks.claimDue(BATCH_SIZE, LEASE_MS);
    await Promise.allSettled(
      due.map((callback) =>
        this.service.deliver(callback).catch((error: unknown) => {
          this.logger.error('Gửi một callback về Store lỗi', error, {
            id: callback.id,
            transCode: callback.transCode,
          });
        }),
      ),
    );
    return due.length;
  }
}
