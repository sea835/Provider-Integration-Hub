import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, asc } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { TransactionStepLogEntity } from '../domain/transaction-step-log.entity';
import { TransactionStepLogRepositoryPort } from '../domain/transaction-step-log.repository.port';
import { transactionStepLogs } from './transaction-step-log.schema';

@Injectable()
export class TransactionStepLogRepository
  extends BaseRepository<TransactionStepLogEntity>
  implements TransactionStepLogRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, transactionStepLogs);
  }

  async findByTransactionId(
    transactionId: string,
  ): Promise<TransactionStepLogEntity[]> {
    const rows = (await this.db
      .select()
      .from(transactionStepLogs)
      .where(eq(transactionStepLogs.transactionId, transactionId))
      .orderBy(
        asc(transactionStepLogs.loggedAt),
      )) as unknown as TransactionStepLogEntity[];
    return rows;
  }
}
