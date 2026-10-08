import { Inject, Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { TransactionRepositoryPort } from '@modules/transaction/domain/transaction.repository.port';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import { TransactionStatus } from '@modules/transaction/domain/transaction-status';
import { canSubmit } from '@modules/transaction/domain/transaction-status.policy';
import { EventSource } from '@modules/transaction/domain/transaction-event';
import { OrderQueuePort } from '@modules/transaction/domain/order-queue.port';
import { OrderStateService } from '@modules/transaction/application/order-state.service';
import { SupplierConfigService } from '@modules/supplier/application/supplier-config.service';
import { SupplierConfig } from '@modules/supplier/domain/supplier-config';
import { SupplierStatus } from '@modules/supplier/domain/supplier-status';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import {
  Outcome,
  SupplierResult,
} from '@modules/provider-adapter/domain/supplier-result';
import {
  ProviderAdapter,
  SupplierContext,
} from '@modules/provider-adapter/domain/provider-adapter.port';
import {
  callAdapter,
  delay,
  DONE,
  ProcessOutcome,
  SUPPLIER_PAUSED_DELAY_MS,
} from '@modules/execution/application/process-outcome';

/** Thêm vào timeout gửi đơn khi đặt next_check_at bảo vệ (worker chết giữa chừng). */
const SUBMIT_GUARD_SEC = 30;

/** G4: gửi đơn sang NCC. */
@Injectable()
export class SubmitProcessor {
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
      SubmitProcessor.name,
    );
  }

  async handle(transCode: string): Promise<ProcessOutcome> {
    const order = await this.orders.findByTransCode(transCode);
    if (!order || !canSubmit(order.status, order.resubmitRequested)) {
      return DONE;
    }

    const config = await this.configs.getById(order.supplierId);
    if (config.status !== SupplierStatus.ACTIVE) {
      return delay(SUPPLIER_PAUSED_DELAY_MS);
    }

    const submitting = await this.state.markSubmitting(
      transCode,
      Math.ceil(config.submitTimeoutMs / 1000) + SUBMIT_GUARD_SEC,
    );
    if (!submitting) return DONE;

    const adapter = this.adapters.get(config.adapterType);
    const ctx = this.configs.toContext(config);
    const rejected = await this.rejectedByCheck(adapter, ctx, submitting);
    let result: SupplierResult;
    if (rejected) {
      result = rejected;
    } else {
      const called = await callAdapter(() =>
        adapter.submit(ctx, {
          transCode,
          action: submitting.action,
          packageCode: submitting.packageCode,
          phone: submitting.phone,
          serial: submitting.serial,
          extra: submitting.extra ?? {},
          attempt: submitting.submitCount,
        }),
      );
      result = called.result;
      if (called.error) {
        this.logger.error('Adapter submit throw', called.error, {
          transCode,
          supplier: config.code,
        });
      }
    }

    const applied = await this.state.applyResult(
      transCode,
      result,
      EventSource.SUBMIT,
    );
    if (applied?.order.status === TransactionStatus.PROCESSING) {
      await this.scheduleFirstCheck(applied.order, config, result);
    }
    return DONE;
  }

  /**
   * Kiểm tra gói trước lần gửi ĐẦU TIÊN (NCC bật "kiểm tra trước khi gửi").
   * Chỉ chặn khi NCC nói rõ không đăng ký được; lỗi hoặc chưa rõ thì vẫn gửi.
   * Không kiểm tra ở lần gửi lại: NCC có thể đã nhận đơn trước đó nên trả "không đăng ký được" sai.
   */
  private async rejectedByCheck(
    adapter: ProviderAdapter,
    ctx: SupplierContext,
    order: TransactionEntity,
  ): Promise<SupplierResult | null> {
    if (order.submitCount !== 1 || !adapter.checkPackage) return null;
    try {
      if (!adapter.features?.(ctx).checkBeforeSubmit) return null;
      const check = await adapter.checkPackage(ctx, {
        action: order.action,
        packageCode: order.packageCode,
        phone: order.phone,
        serial: order.serial,
        extra: order.extra ?? {},
      });
      if (check.eligible !== false) return null;
      this.logger.info('Gói không đăng ký được, không gửi đơn', {
        transCode: order.transCode,
        supplier: ctx.supplierCode,
        reason: check.reason?.code,
      });
      return {
        outcome: Outcome.FAILED,
        error: {
          code: check.reason?.code ?? 'PACKAGE_NOT_ELIGIBLE',
          message:
            check.reason?.message ??
            'Nhà cung cấp báo không đăng ký được gói này',
        },
        trace: check.trace,
      };
    } catch (error) {
      this.logger.warn('Kiểm tra gói lỗi, vẫn gửi đơn', {
        transCode: order.transCode,
        supplier: ctx.supplierCode,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async scheduleFirstCheck(
    order: TransactionEntity,
    config: SupplierConfig,
    result: SupplierResult,
  ): Promise<void> {
    const delaySec = result.retryAfterSec ?? config.pollScheduleSec[0] ?? 5;
    const scheduled = await this.state.scheduleCheck(
      order.transCode,
      delaySec,
      false,
    );
    if (!scheduled) return;
    await this.queue.enqueueCheck(
      scheduled.supplierCode,
      scheduled.transCode,
      scheduled.checkCount + 1,
      delaySec * 1000,
    );
  }
}
