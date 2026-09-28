import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';

export abstract class TransactionRepositoryPort extends BaseRepositoryPort<TransactionEntity> {}
