import { BaseEntity } from '@common/base/base.entity';

export class TransactionEntity extends BaseEntity {
  transCode: string;
  partnerTransId: string;
  supplierTransId: string;
  supplierId: string;
  variantId: string;
  action: string; // BUY_DATA | TOPUP | ACTIVATE_SIM | CANCEL_PACKAGE
  targetPhone: string;
  serial: string;
  amount: number;
  costAmount: number;
  errorCode: string;
  errorMessage: string;
}
