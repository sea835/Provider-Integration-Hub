import { BaseEntity } from '@common/base/base.entity';
import { TransactionStatusType } from '@modules/transaction/domain/transaction-status';
import { OrderActionType } from '@modules/provider-adapter/domain/order-action';
import { OrderDelivery } from '@modules/provider-adapter/domain/supplier-result';

/** Đơn đăng ký Store gửi qua Core sang NCC. */
export class TransactionEntity extends BaseEntity {
  declare status: TransactionStatusType;
  transCode: string;
  merchantId: string;
  partnerTransId: string;
  requestHash: string;
  action: OrderActionType;
  supplierId: string;
  supplierCode: string;
  packageCode: string;
  configVersion: number;
  phone: string | null;
  serial: string | null;
  supplierTransId: string | null;
  submitCount: number;
  checkCount: number;
  resubmitRequested: boolean;
  nextCheckAt: Date | null;
  /** Mốc bắt đầu vòng tra cứu hiện tại (null = từ lúc tạo đơn). Vận hành tra cứu lại thì đặt mới. */
  checkWindowStartedAt: Date | null;
  /** checkCount tại lúc mở vòng tra cứu hiện tại, để lịch poll chạy lại từ đầu. */
  checkWindowBase: number;
  delivery: OrderDelivery;
  errorCode: string | null;
  errorMessage: string | null;
  completedAt: Date | null;
}
