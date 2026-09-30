import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { TransactionJobEntity } from './transaction-job.entity';

export abstract class TransactionJobRepositoryPort extends BaseRepositoryPort<TransactionJobEntity> {
  abstract findByTransactionId(
    transactionId: string,
  ): Promise<TransactionJobEntity[]>;
  abstract findByJobId(jobId: string): Promise<TransactionJobEntity | null>;
}
