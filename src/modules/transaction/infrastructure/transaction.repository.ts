import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from '@common/base/base.repository';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import { TransactionRepositoryPort } from '@modules/transaction/domain/transaction.repository.port';
import { transactions } from './transaction.schema';

@Injectable()
export class TransactionRepository
  extends BaseRepository<TransactionEntity>
  implements TransactionRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, transactions);
  }
}
