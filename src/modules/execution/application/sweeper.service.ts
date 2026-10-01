import { Inject, Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { TransactionRepositoryPort } from '@modules/transaction/domain/transaction.repository.port';
import { OrderQueuePort } from '@modules/transaction/domain/order-queue.port';

const PENDING_GRACE_MS = 30_000;
const PROCESSING_GRACE_MS = 60_000;
const BATCH_SIZE = 500;

/**
 * Tự phục hồi khi Redis mất job (restart, flush, enqueue lỗi sau commit).
 * Chỉ enqueue lại; processor có guard nên enqueue thừa cũng vô hại.
 */
@Injectable()
export class SweeperService {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(TransactionRepositoryPort)
    private readonly orders: TransactionRepositoryPort,
    private readonly queue: OrderQueuePort,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Execution',
      SweeperService.name,
    );
  }

  async run(): Promise<{ pending: number; processing: number }> {
    const now = Date.now();

    const pending = await this.orders.findStalePending(
      new Date(now - PENDING_GRACE_MS),
      BATCH_SIZE,
    );
    for (const order of pending) {
      await this.queue.enqueueSubmit(
        order.supplierCode,
        order.transCode,
        order.submitCount + 1,
      );
    }

    const processing = await this.orders.findDueProcessing(
      new Date(now - PROCESSING_GRACE_MS),
      BATCH_SIZE,
    );
    for (const order of processing) {
      if (order.resubmitRequested) {
        await this.queue.enqueueSubmit(
          order.supplierCode,
          order.transCode,
          order.submitCount + 1,
        );
      } else {
        await this.queue.enqueueCheck(
          order.supplierCode,
          order.transCode,
          order.checkCount + 1,
          0,
        );
      }
    }

    if (pending.length + processing.length > 0) {
      this.logger.info('Sweeper enqueue lại đơn bị kẹt', {
        pending: pending.length,
        processing: processing.length,
      });
    }
    return { pending: pending.length, processing: processing.length };
  }
}
