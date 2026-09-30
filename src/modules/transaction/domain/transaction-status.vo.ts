export type TransactionStatus =
  'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type TransactionAction =
  'BUY_DATA' | 'TOPUP' | 'ACTIVATE_SIM' | 'CANCEL_PACKAGE';
