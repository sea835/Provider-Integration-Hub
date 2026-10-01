import { Inject, Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { TransactionRepositoryPort } from '@modules/transaction/domain/transaction.repository.port';
import { TransactionStatus } from '@modules/transaction/domain/transaction-status';
import { EventSource } from '@modules/transaction/domain/transaction-event';
import { OrderQueuePort } from '@modules/transaction/domain/order-queue.port';
import { OrderStateService } from '@modules/transaction/application/order-state.service';
import { SupplierConfigService } from '@modules/supplier/application/supplier-config.service';
import { SupplierStatus } from '@modules/supplier/domain/supplier-status';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import { Outcome } from '@modules/provider-adapter/domain/supplier-result';
import {
  callAdapter,
  delay,
  DONE,
  ProcessOutcome,
  SUPPLIER_PAUSED_DELAY_MS,
} from '@modules/execution/application/process-outcome';

/** G5: tra cứu trạng thái đơn ở NCC, lên lịch lần tiếp theo hoặc chuyển MANUAL_REVIEW. */
@Injectable()
export class CheckProcessor {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(TransactionRepositoryPort)
    private readonly orders: TransactionRepositoryPort,
    private readonly state: OrderStateService,
    private readonly configs: SupplierConfigService,
    private readonly adapters: AdapterRegistry,
    private readonly queue: OrderQueuePort,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Execution',
      CheckProcessor.name,
    );
  }

  async handle(transCode: string): Promise<ProcessOutcome> {
    const order = await this.orders.findByTransCode(transCode);
    if (
      !order ||
      order.status !== TransactionStatus.PROCESSING ||
      order.resubmitRequested
    ) {
      return DONE;
    }

    const config = await this.configs.getById(order.supplierId);
    if (config.status !== SupplierStatus.ACTIVE) {
      return delay(SUPPLIER_PAUSED_DELAY_MS);
    }

    const adapter = this.adapters.get(config.adapterType);
    const { result, error } = await callAdapter(() =>
      adapter.query(this.configs.toContext(config), {
        transCode,
        supplierTransId: order.supplierTransId,
      }),
    );
    if (error) {
      this.logger.error('Adapter query throw', error, {
        transCode,
        supplier: config.code,
      });
    }

    const applied = await this.state.applyResult(
      transCode,
      result,
      EventSource.CHECK,
    );
    if (!applied || applied.order.status !== TransactionStatus.PROCESSING) {
      return DONE;
    }
    const current = applied.order;

    if (result.outcome === Outcome.NOT_FOUND) {
      if (current.submitCount <= config.maxResubmit) {
        const flagged = await this.state.requestResubmit(transCode);
        if (flagged) {
          await this.queue.enqueueSubmit(
            flagged.supplierCode,
            transCode,
            flagged.submitCount + 1,
          );
        }
      } else {
        await this.state.moveToManualReview(
          transCode,
          `NCC không tìm thấy đơn sau ${current.submitCount} lần gửi`,
          EventSource.CHECK,
        );
      }
      return DONE;
    }

    const ageSec = (Date.now() - new Date(current.createdAt).getTime()) / 1000;
    if (ageSec > config.maxWaitSec) {
      await this.state.moveToManualReview(
        transCode,
        `Quá ${config.maxWaitSec}s chưa có kết quả cuối từ NCC`,
        EventSource.CHECK,
      );
      return DONE;
    }

    const schedule = config.pollScheduleSec;
    const delaySec =
      result.retryAfterSec ??
      schedule[Math.min(current.checkCount + 1, schedule.length - 1)];
    const scheduled = await this.state.scheduleCheck(transCode, delaySec, true);
    if (scheduled) {
      await this.queue.enqueueCheck(
        scheduled.supplierCode,
        transCode,
        scheduled.checkCount + 1,
        delaySec * 1000,
      );
    }
    return DONE;
  }
}
