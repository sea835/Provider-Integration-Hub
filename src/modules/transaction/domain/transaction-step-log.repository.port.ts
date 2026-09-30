import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { TransactionStepLogEntity } from './transaction-step-log.entity';

export abstract class TransactionStepLogRepositoryPort extends BaseRepositoryPort<TransactionStepLogEntity> {
  abstract findByTransactionId(
    transactionId: string,
  ): Promise<TransactionStepLogEntity[]>;
}
