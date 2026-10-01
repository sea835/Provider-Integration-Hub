import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { PaginatedResult } from '@common/base/pagination.dto';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import { TransactionStatusType } from '@modules/transaction/domain/transaction-status';
import {
  CallbackEventEntity,
  NewTransactionEvent,
  TransactionEventEntity,
} from '@modules/transaction/domain/transaction-event';

export interface AdminOrderFilter {
  status?: TransactionStatusType;
  supplierCode?: string;
  merchantId?: string;
  page: number;
  limit: number;
}

export abstract class TransactionRepositoryPort extends BaseRepositoryPort<TransactionEntity> {
  abstract findByTransCode(
    transCode: string,
  ): Promise<TransactionEntity | null>;
  abstract findByMerchantRequest(
    merchantId: string,
    partnerTransId: string,
  ): Promise<TransactionEntity | null>;
  abstract findBySupplierTrans(
    supplierId: string,
    supplierTransId: string,
  ): Promise<TransactionEntity | null>;
  /** INSERT ... ON CONFLICT (merchant_id, partner_trans_id) DO NOTHING. */
  abstract insertIfAbsent(
    data: Partial<TransactionEntity>,
  ): Promise<TransactionEntity | null>;
  /** SELECT ... FOR UPDATE, phải gọi trong TransactionRunnerPort.run. */
  abstract lockByTransCode(
    transCode: string,
  ): Promise<TransactionEntity | null>;
  abstract listForAdmin(
    filter: AdminOrderFilter,
  ): Promise<PaginatedResult<TransactionEntity>>;
  abstract findStalePending(
    createdBefore: Date,
    limit: number,
  ): Promise<TransactionEntity[]>;
  abstract findDueProcessing(
    dueBefore: Date,
    limit: number,
  ): Promise<TransactionEntity[]>;
}

export abstract class TransactionEventRepositoryPort {
  abstract record(event: NewTransactionEvent): Promise<void>;
  abstract listByTransaction(
    transactionId: string,
  ): Promise<TransactionEventEntity[]>;
}

export abstract class CallbackEventRepositoryPort {
  /** Trả null nếu (supplierId, eventId) đã tồn tại. */
  abstract insertIfAbsent(
    event: Omit<
      CallbackEventEntity,
      'id' | 'receivedAt' | 'matchedTransactionId'
    >,
  ): Promise<CallbackEventEntity | null>;
  abstract markMatched(id: string, transactionId: string): Promise<void>;
}
