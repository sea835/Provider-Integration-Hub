import {
  TransactionStatus,
  TransactionStatusType,
} from '@modules/transaction/domain/transaction-status';
import {
  Outcome,
  OutcomeType,
} from '@modules/provider-adapter/domain/supplier-result';

const TERMINAL: ReadonlySet<string> = new Set([
  TransactionStatus.COMPLETED,
  TransactionStatus.FAILED,
  TransactionStatus.CANCELLED,
]);

/** Trạng thái cuối không bao giờ tự đổi. */
export function isTerminal(status: TransactionStatusType): boolean {
  return TERMINAL.has(status);
}

/** Kết quả đến sau mâu thuẫn với trạng thái cuối đã chốt. */
export function isConflict(
  status: TransactionStatusType,
  outcome: OutcomeType,
): boolean {
  return (
    (status === TransactionStatus.COMPLETED && outcome === Outcome.FAILED) ||
    (status === TransactionStatus.FAILED && outcome === Outcome.SUCCESS) ||
    (status === TransactionStatus.CANCELLED && outcome === Outcome.SUCCESS)
  );
}

/** Trạng thái hiển thị cho merchant: MANUAL_REVIEW là việc nội bộ. */
export function toPublicStatus(
  status: TransactionStatusType,
): TransactionStatusType {
  return status === TransactionStatus.MANUAL_REVIEW
    ? TransactionStatus.PROCESSING
    : status;
}

/** Không cần gửi NCC nữa? (dùng cho guard của processor) */
export function canSubmit(
  status: TransactionStatusType,
  resubmitRequested: boolean,
): boolean {
  return (
    status === TransactionStatus.PENDING ||
    (status === TransactionStatus.PROCESSING && resubmitRequested)
  );
}
