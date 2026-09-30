import { BaseEntity } from '@common/base/base.entity';
import { TransactionStatus, TransactionAction } from './transaction-status.vo';

export class TransactionEntity extends BaseEntity {
  transCode: string;
  partnerTransId: string;
  supplierTransId?: string | null;
  supplierId?: string | null;
  variantId?: string | null;
  providerCode: string;
  packageCode: string;
  action: TransactionAction;
  targetPhone?: string | null;
  serial?: string | null;
  amount: number;
  costAmount?: number | null;
  declare status: TransactionStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  lpaString?: string | null;
  qrUrl?: string | null;
  completedAt?: Date | null;
}
