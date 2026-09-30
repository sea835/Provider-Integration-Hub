import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
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

  async findByTransCode(transCode: string): Promise<TransactionEntity | null> {
    const rows = (await this.db
      .select()
      .from(transactions)
      .where(
        eq(transactions.transCode, transCode),
      )) as unknown as TransactionEntity[];
    return rows[0] || null;
  }

  async findByPartnerTransId(
    partnerTransId: string,
  ): Promise<TransactionEntity | null> {
    const rows = (await this.db
      .select()
      .from(transactions)
      .where(
        eq(transactions.partnerTransId, partnerTransId),
      )) as unknown as TransactionEntity[];
    return rows[0] || null;
  }

  async findBySupplierTransId(
    supplierTransId: string,
  ): Promise<TransactionEntity | null> {
    const rows = (await this.db
      .select()
      .from(transactions)
      .where(
        eq(transactions.supplierTransId, supplierTransId),
      )) as unknown as TransactionEntity[];
    return rows[0] || null;
  }
}
