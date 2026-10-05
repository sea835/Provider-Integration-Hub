import { Inject, Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { TransactionRunnerPort } from '@common/database/transaction-runner.port';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import {
  TransactionEventRepositoryPort,
  TransactionRepositoryPort,
} from '@modules/transaction/domain/transaction.repository.port';
import {
  TransactionStatus,
  TransactionStatusType,
} from '@modules/transaction/domain/transaction-status';
import {
  canSubmit,
  isConflict,
  isTerminal,
} from '@modules/transaction/domain/transaction-status.policy';
import {
  EventSource,
  EventSourceType,
  EventType,
  EventTypeType,
} from '@modules/transaction/domain/transaction-event';
import {
  InvalidStateTransitionError,
  OrderNotFoundError,
} from '@modules/transaction/domain/transaction.errors';
import {
  OrderDelivery,
  Outcome,
  SupplierResult,
} from '@modules/provider-adapter/domain/supplier-result';
import {
  callbackEventOf,
  StoreCallbackRepositoryPort,
} from '@modules/transaction/domain/store-callback';

export interface ApplyResultOutput {
  order: TransactionEntity;
  changed: boolean;
  conflict: boolean;
}

/**
 * Nơi DUY NHẤT được đổi trạng thái đơn.
 * Mỗi hàm chạy trong một DB transaction và khoá dòng đơn (FOR UPDATE),
 * nên callback và poll đến cùng lúc không ghi đè nhau.
 */
@Injectable()
export class OrderStateService {
  private readonly logger: LoggerPort;

  constructor(
    @Inject(TransactionRepositoryPort)
    private readonly orders: TransactionRepositoryPort,
    @Inject(TransactionEventRepositoryPort)
    private readonly events: TransactionEventRepositoryPort,
    private readonly runner: TransactionRunnerPort,
    @Inject(StoreCallbackRepositoryPort)
    private readonly callbacks: StoreCallbackRepositoryPort,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Transaction',
      OrderStateService.name,
    );
  }

  /**
   * Chuyển sang PROCESSING trước khi gọi NCC. Đặt next_check_at để Sweeper
   * vớt được nếu worker chết giữa chừng. Trả null nếu đơn không cần gửi nữa.
   */
  markSubmitting(
    transCode: string,
    guardDelaySec: number,
  ): Promise<TransactionEntity | null> {
    return this.runner.run(async () => {
      const order = await this.orders.lockByTransCode(transCode);
      if (!order || !canSubmit(order.status, order.resubmitRequested)) {
        return null;
      }

      const updated = await this.save(order, {
        status: TransactionStatus.PROCESSING,
        submitCount: order.submitCount + 1,
        resubmitRequested: false,
        nextCheckAt: secondsFromNow(guardDelaySec),
      });
      await this.record(updated, EventSource.SUBMIT, EventType.SUBMIT_STARTED, {
        fromStatus: order.status,
        toStatus: updated.status,
        message: `Gửi NCC lần ${updated.submitCount}`,
      });
      return updated;
    });
  }

  applyResult(
    transCode: string,
    result: SupplierResult,
    source: EventSourceType,
  ): Promise<ApplyResultOutput | null> {
    return this.runner.run(async () => {
      const order = await this.orders.lockByTransCode(transCode);
      if (!order) return null;

      const from = order.status;
      if (isTerminal(from)) {
        const conflict = isConflict(from, result.outcome);
        await this.recordResult(
          order,
          result,
          source,
          from,
          from,
          conflict ? EventType.CONFLICT : EventType.RESULT,
        );
        if (conflict) {
          this.logger.warn('Kết quả NCC mâu thuẫn với trạng thái đã chốt', {
            transCode,
            status: from,
            outcome: result.outcome,
            source,
          });
        }
        return { order, changed: false, conflict };
      }

      let updated: TransactionEntity;
      switch (result.outcome) {
        case Outcome.SUCCESS:
          updated = await this.save(order, {
            status: TransactionStatus.COMPLETED,
            supplierTransId: result.supplierTransId ?? order.supplierTransId,
            delivery: mergeDelivery(order.delivery, result.delivery),
            errorCode: null,
            errorMessage: null,
            nextCheckAt: null,
            resubmitRequested: false,
            completedAt: new Date(),
          });
          break;
        case Outcome.FAILED:
          updated = await this.save(order, {
            status: TransactionStatus.FAILED,
            supplierTransId: result.supplierTransId ?? order.supplierTransId,
            errorCode: result.error?.code ?? 'SUPPLIER_FAILED',
            errorMessage: result.error?.message ?? null,
            nextCheckAt: null,
            resubmitRequested: false,
            completedAt: new Date(),
          });
          break;
        default:
          updated = await this.save(order, {
            supplierTransId:
              order.supplierTransId ?? result.supplierTransId ?? null,
            delivery: mergeDelivery(order.delivery, result.delivery),
          });
      }

      await this.recordResult(
        updated,
        result,
        source,
        from,
        updated.status,
        EventType.RESULT,
      );
      const event = isTerminal(updated.status)
        ? callbackEventOf(updated)
        : null;
      if (event) await this.callbacks.enqueue(updated, event);
      if (from !== updated.status) {
        this.logger.info('Đơn đổi trạng thái', {
          transCode,
          from,
          to: updated.status,
          source,
          errorCode: updated.errorCode,
        });
      }
      return {
        order: updated,
        changed: from !== updated.status,
        conflict: false,
      };
    });
  }

  /** Hẹn lần tra cứu tiếp theo. Trả null nếu đơn không còn PROCESSING. */
  scheduleCheck(
    transCode: string,
    delaySec: number,
    countCheck: boolean,
  ): Promise<TransactionEntity | null> {
    return this.runner.run(async () => {
      const order = await this.orders.lockByTransCode(transCode);
      if (!order || order.status !== TransactionStatus.PROCESSING) return null;
      return this.save(order, {
        nextCheckAt: secondsFromNow(delaySec),
        checkCount: order.checkCount + (countCheck ? 1 : 0),
      });
    });
  }

  /** NCC không tìm thấy đơn: đánh dấu gửi lại (cùng transCode, idempotent phía NCC). */
  requestResubmit(transCode: string): Promise<TransactionEntity | null> {
    return this.runner.run(async () => {
      const order = await this.orders.lockByTransCode(transCode);
      if (!order || order.status !== TransactionStatus.PROCESSING) return null;
      const updated = await this.save(order, {
        resubmitRequested: true,
        nextCheckAt: new Date(),
      });
      await this.record(
        updated,
        EventSource.CHECK,
        EventType.RESUBMIT_REQUESTED,
        {
          message: `NCC không tìm thấy đơn sau ${order.submitCount} lần gửi`,
        },
      );
      return updated;
    });
  }

  /** Hệ thống không tự kết luận được: chờ vận hành đối soát với NCC. */
  moveToManualReview(
    transCode: string,
    reason: string,
    source: EventSourceType,
  ): Promise<TransactionEntity | null> {
    return this.runner.run(async () => {
      const order = await this.orders.lockByTransCode(transCode);
      if (!order || order.status !== TransactionStatus.PROCESSING) return null;
      const updated = await this.save(order, {
        status: TransactionStatus.MANUAL_REVIEW,
        nextCheckAt: null,
        resubmitRequested: false,
        errorCode: 'MANUAL_REVIEW',
        errorMessage: reason,
      });
      await this.record(updated, source, EventType.MANUAL_REVIEW, {
        fromStatus: order.status,
        toStatus: updated.status,
        message: reason,
      });
      this.logger.warn('Đơn chuyển MANUAL_REVIEW', { transCode, reason });
      return updated;
    });
  }

  /**
   * Vận hành cho đơn MANUAL_REVIEW tra cứu lại: về PROCESSING, mở vòng tra cứu mới
   * (thời gian chờ và lịch poll tính lại từ đầu). Không gửi lại đơn sang NCC.
   */
  reopenForCheck(
    transCode: string,
    reason: string,
    actorId: string,
  ): Promise<TransactionEntity> {
    return this.runner.run(async () => {
      const order = await this.orders.lockByTransCode(transCode);
      if (!order) throw new OrderNotFoundError(transCode);
      if (order.status !== TransactionStatus.MANUAL_REVIEW) {
        throw new InvalidStateTransitionError(
          `Chỉ tra cứu lại được đơn MANUAL_REVIEW, đơn đang ${order.status}`,
        );
      }
      const updated = await this.save(order, {
        status: TransactionStatus.PROCESSING,
        nextCheckAt: new Date(),
        checkWindowStartedAt: new Date(),
        checkWindowBase: order.checkCount,
        resubmitRequested: false,
        errorCode: null,
        errorMessage: null,
      });
      await this.record(
        updated,
        EventSource.OPERATOR,
        EventType.RECHECK_REQUESTED,
        {
          fromStatus: order.status,
          toStatus: updated.status,
          message: reason,
          request: { actorId, reason },
        },
      );
      this.logger.info('Vận hành cho đơn tra cứu lại', { transCode, actorId });
      return updated;
    });
  }

  /** Vận hành chốt kết quả cho đơn chưa ở trạng thái cuối. */
  async resolve(
    transCode: string,
    outcome: typeof Outcome.SUCCESS | typeof Outcome.FAILED,
    reason: string,
    actorId: string,
    details: ResolveDetails = {},
  ): Promise<TransactionEntity> {
    const order = await this.orders.findByTransCode(transCode);
    if (!order) throw new OrderNotFoundError(transCode);
    if (isTerminal(order.status)) {
      throw new InvalidStateTransitionError(
        `Đơn ${transCode} đã ở trạng thái cuối ${order.status}`,
      );
    }

    const output = await this.applyResult(
      transCode,
      {
        outcome,
        error:
          outcome === Outcome.FAILED
            ? { code: details.errorCode || 'OPERATOR_FAILED', message: reason }
            : undefined,
        ...(details.supplierTransId
          ? { supplierTransId: details.supplierTransId }
          : {}),
        ...(outcome === Outcome.SUCCESS && details.delivery
          ? { delivery: cleanDelivery(details.delivery) }
          : {}),
        trace: {
          request: { actorId, reason, ...details },
          durationMs: 0,
        },
      },
      EventSource.OPERATOR,
    );
    if (!output) throw new OrderNotFoundError(transCode);
    if (!output.changed) {
      throw new InvalidStateTransitionError(
        `Đơn ${transCode} vừa được chốt ${output.order.status} trước thao tác này`,
      );
    }
    return output.order;
  }

  private async save(
    order: TransactionEntity,
    patch: Partial<TransactionEntity>,
  ): Promise<TransactionEntity> {
    const updated = await this.orders.update(order.id, patch);
    if (!updated) throw new OrderNotFoundError(order.transCode);
    return updated;
  }

  private recordResult(
    order: TransactionEntity,
    result: SupplierResult,
    source: EventSourceType,
    from: TransactionStatusType,
    to: TransactionStatusType,
    type: EventTypeType,
  ): Promise<void> {
    return this.record(order, source, type, {
      outcome: result.outcome,
      fromStatus: from,
      toStatus: to,
      httpStatus: result.trace.httpStatus ?? null,
      durationMs: result.trace.durationMs ?? null,
      message: result.error
        ? `${result.error.code}: ${result.error.message}`
        : null,
      request: result.trace.request ?? null,
      response: result.trace.response ?? null,
    });
  }

  private record(
    order: TransactionEntity,
    source: EventSourceType,
    type: EventTypeType,
    extra: {
      outcome?: string | null;
      fromStatus?: string | null;
      toStatus?: string | null;
      httpStatus?: number | null;
      durationMs?: number | null;
      message?: string | null;
      request?: unknown;
      response?: unknown;
    } = {},
  ): Promise<void> {
    return this.events.record({
      transactionId: order.id,
      source,
      type,
      configVersion: order.configVersion,
      ...extra,
    });
  }
}

export interface ResolveDetails {
  errorCode?: string;
  supplierTransId?: string;
  delivery?: OrderDelivery;
}

function cleanDelivery(delivery: OrderDelivery): OrderDelivery {
  return Object.fromEntries(
    Object.entries(delivery).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && entry[1].trim() !== '',
    ),
  );
}

function secondsFromNow(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

function mergeDelivery(
  current: OrderDelivery,
  incoming: OrderDelivery | undefined,
): OrderDelivery {
  return incoming ? { ...current, ...incoming } : current;
}
