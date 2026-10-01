import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, count, desc, eq, lt, SQL } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { PaginatedResult } from '@common/base/pagination.dto';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import {
  AdminOrderFilter,
  TransactionRepositoryPort,
} from '@modules/transaction/domain/transaction.repository.port';
import { TransactionStatus } from '@modules/transaction/domain/transaction-status';
import { transactions } from '@modules/transaction/infrastructure/transaction.schema';

@Injectable()
export class TransactionRepository
  extends BaseRepository<TransactionEntity>
  implements TransactionRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, transactions);
  }

  findByTransCode(transCode: string): Promise<TransactionEntity | null> {
    return this.first(eq(transactions.transCode, transCode));
  }

  findByMerchantRequest(
    merchantId: string,
    partnerTransId: string,
  ): Promise<TransactionEntity | null> {
    return this.first(
      and(
        eq(transactions.merchantId, merchantId),
        eq(transactions.partnerTransId, partnerTransId),
      )!,
    );
  }

  findBySupplierTrans(
    supplierId: string,
    supplierTransId: string,
  ): Promise<TransactionEntity | null> {
    return this.first(
      and(
        eq(transactions.supplierId, supplierId),
        eq(transactions.supplierTransId, supplierTransId),
      )!,
    );
  }

  async insertIfAbsent(
    data: Partial<TransactionEntity>,
  ): Promise<TransactionEntity | null> {
    const rows = await this.conn
      .insert(transactions)
      .values(data as typeof transactions.$inferInsert)
      .onConflictDoNothing({
        target: [transactions.merchantId, transactions.partnerTransId],
      })
      .returning();
    return (rows[0] as TransactionEntity | undefined) ?? null;
  }

  async lockByTransCode(transCode: string): Promise<TransactionEntity | null> {
    const rows = await this.conn
      .select()
      .from(transactions)
      .where(eq(transactions.transCode, transCode))
      .for('update');
    return (rows[0] as TransactionEntity | undefined) ?? null;
  }

  async listForAdmin(
    filter: AdminOrderFilter,
  ): Promise<PaginatedResult<TransactionEntity>> {
    const where = and(
      filter.status ? eq(transactions.status, filter.status) : undefined,
      filter.supplierCode
        ? eq(transactions.supplierCode, filter.supplierCode)
        : undefined,
      filter.merchantId
        ? eq(transactions.merchantId, filter.merchantId)
        : undefined,
    );
    const [data, totals] = await Promise.all([
      this.conn
        .select()
        .from(transactions)
        .where(where)
        .orderBy(desc(transactions.createdAt))
        .limit(filter.limit)
        .offset((filter.page - 1) * filter.limit),
      this.conn.select({ value: count() }).from(transactions).where(where),
    ]);
    const total = Number(totals[0]?.value ?? 0);
    const totalPages = Math.ceil(total / filter.limit);
    return {
      data: data as TransactionEntity[],
      meta: {
        total,
        page: filter.page,
        limit: filter.limit,
        totalPages,
        hasNextPage: filter.page < totalPages,
        hasPrevPage: filter.page > 1,
      },
    };
  }

  async findStalePending(
    createdBefore: Date,
    limit: number,
  ): Promise<TransactionEntity[]> {
    const rows = await this.conn
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.status, TransactionStatus.PENDING),
          lt(transactions.createdAt, createdBefore),
        ),
      )
      .orderBy(asc(transactions.createdAt))
      .limit(limit);
    return rows as TransactionEntity[];
  }

  async findDueProcessing(
    dueBefore: Date,
    limit: number,
  ): Promise<TransactionEntity[]> {
    const rows = await this.conn
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.status, TransactionStatus.PROCESSING),
          lt(transactions.nextCheckAt, dueBefore),
        ),
      )
      .orderBy(asc(transactions.nextCheckAt))
      .limit(limit);
    return rows as TransactionEntity[];
  }

  private async first(where: SQL): Promise<TransactionEntity | null> {
    const rows = await this.conn.select().from(transactions).where(where);
    return (rows[0] as TransactionEntity | undefined) ?? null;
  }
}
