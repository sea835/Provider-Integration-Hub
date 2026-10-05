import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import { TransactionStatus } from '@modules/transaction/domain/transaction-status';

export const StoreCallbackStatus = {
  PENDING: 'PENDING',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

export type StoreCallbackStatusType =
  (typeof StoreCallbackStatus)[keyof typeof StoreCallbackStatus];

export const STORE_CALLBACK_STATUS_VALUES = Object.values(StoreCallbackStatus);

export const StoreCallbackEvent = {
  ORDER_COMPLETED: 'order.completed',
  ORDER_FAILED: 'order.failed',
  ORDER_CANCELLED: 'order.cancelled',
} as const;

export type StoreCallbackEventType =
  (typeof StoreCallbackEvent)[keyof typeof StoreCallbackEvent];

/** Một lần báo kết quả cuối của đơn về Store (outbox, gửi lại đến khi Store trả 2xx). */
export class StoreCallbackEntity {
  id: string;
  transactionId: string;
  merchantId: string;
  transCode: string;
  event: StoreCallbackEventType;
  status: StoreCallbackStatusType;
  attempts: number;
  nextAttemptAt: Date | null;
  lastUrl: string | null;
  lastHttpStatus: number | null;
  lastDurationMs: number | null;
  lastError: string | null;
  lastResponse: string | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreCallbackAttempt {
  attempts: number;
  status: StoreCallbackStatusType;
  nextAttemptAt: Date | null;
  url: string | null;
  httpStatus: number | null;
  durationMs: number | null;
  error: string | null;
  response: string | null;
}

export interface StoreCallbackFilter {
  merchantId?: string;
  transactionId?: string;
  status?: StoreCallbackStatusType;
  limit: number;
}

export function callbackEventOf(
  order: TransactionEntity,
): StoreCallbackEventType | null {
  switch (order.status) {
    case TransactionStatus.COMPLETED:
      return StoreCallbackEvent.ORDER_COMPLETED;
    case TransactionStatus.FAILED:
      return StoreCallbackEvent.ORDER_FAILED;
    case TransactionStatus.CANCELLED:
      return StoreCallbackEvent.ORDER_CANCELLED;
    default:
      return null;
  }
}

export abstract class StoreCallbackRepositoryPort {
  /** Ghi outbox; gọi trong cùng DB transaction với lúc đơn chốt. */
  abstract enqueue(
    order: TransactionEntity,
    event: StoreCallbackEventType,
  ): Promise<void>;
  /**
   * Nhận tối đa `limit` bản ghi đến hạn (FOR UPDATE SKIP LOCKED) và dời hạn thêm
   * `leaseMs` để process khác không gửi trùng; process chết giữa chừng thì hết hạn là gửi lại.
   */
  abstract claimDue(
    limit: number,
    leaseMs: number,
  ): Promise<StoreCallbackEntity[]>;
  abstract recordAttempt(
    id: string,
    attempt: StoreCallbackAttempt,
  ): Promise<void>;
  abstract findById(id: string): Promise<StoreCallbackEntity | null>;
  abstract list(filter: StoreCallbackFilter): Promise<StoreCallbackEntity[]>;
  /** Cho gửi lại ngay (vận hành bấm gửi lại). */
  abstract requeue(id: string): Promise<StoreCallbackEntity | null>;
}
