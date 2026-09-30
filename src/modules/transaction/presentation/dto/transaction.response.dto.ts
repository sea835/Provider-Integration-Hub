import {
  TransactionStatus,
  TransactionAction,
} from '../../domain/transaction-status.vo';

export class TransactionResponseDto {
  transCode: string;
  requestId: string;
  supplierTransId?: string | null;
  providerCode: string;
  packageCode: string;
  action: TransactionAction;
  status: TransactionStatus;
  phone?: string | null;
  serial?: string | null;
  amount: number;
  costAmount?: number | null;
  lpaString?: string | null;
  qrUrl?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
}
