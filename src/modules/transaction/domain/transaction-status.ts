export const TransactionStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
} as const;

export type TransactionStatusType =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const TRANSACTION_STATUS_VALUES = Object.values(TransactionStatus);
