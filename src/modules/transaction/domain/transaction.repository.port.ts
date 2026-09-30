import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';

export abstract class TransactionRepositoryPort extends BaseRepositoryPort<TransactionEntity> {
  abstract findByTransCode(
    transCode: string,
  ): Promise<TransactionEntity | null>;
  abstract findByPartnerTransId(
    partnerTransId: string,
  ): Promise<TransactionEntity | null>;
  abstract findBySupplierTransId(
    supplierTransId: string,
  ): Promise<TransactionEntity | null>;
}
