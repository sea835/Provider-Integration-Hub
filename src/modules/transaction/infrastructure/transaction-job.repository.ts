import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { TransactionJobEntity } from '../domain/transaction-job.entity';
import { TransactionJobRepositoryPort } from '../domain/transaction-job.repository.port';
import { transactionJobs } from './transaction-job.schema';

@Injectable()
export class TransactionJobRepository
  extends BaseRepository<TransactionJobEntity>
  implements TransactionJobRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, transactionJobs);
  }

  async findByTransactionId(
    transactionId: string,
  ): Promise<TransactionJobEntity[]> {
    const rows = (await this.db
      .select()
      .from(transactionJobs)
      .where(eq(transactionJobs.transactionId, transactionId))
      .orderBy(
        desc(transactionJobs.createdAt),
      )) as unknown as TransactionJobEntity[];
    return rows;
  }

  async findByJobId(jobId: string): Promise<TransactionJobEntity | null> {
    const rows = (await this.db
      .select()
      .from(transactionJobs)
      .where(
        eq(transactionJobs.jobId, jobId),
      )) as unknown as TransactionJobEntity[];
    return rows[0] || null;
  }
}
