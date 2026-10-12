import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PaginatedResult } from '@common/base/pagination.dto';
import { DbContext } from '@infrastructure/database/db-context';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { BalanceCheckEntity } from '@modules/provider/domain/balance-check.entity';
import {
  BalanceCheckFilter,
  BalanceCheckRepositoryPort,
  BalancePoint,
} from '@modules/provider/domain/balance-check.repository.port';
import { CheckStatus } from '@modules/provider/domain/provider-status';
import { balanceChecks } from '@modules/provider/infrastructure/provider.schema';

@Injectable()
export class BalanceCheckRepository implements BalanceCheckRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  private get conn(): NodePgDatabase {
    return DbContext.current() ?? this.db;
  }

  async create(
    data: Omit<BalanceCheckEntity, 'id' | 'checkedAt'> & { checkedAt?: Date },
  ): Promise<BalanceCheckEntity> {
    const result = (await this.conn
      .insert(balanceChecks)
      .values(data)
      .returning()) as BalanceCheckEntity[];
    return result[0];
  }

  async findPaginated(
    filter: BalanceCheckFilter,
  ): Promise<PaginatedResult<BalanceCheckEntity>> {
    const limit = Math.min(Math.max(Number(filter.limit) || 20, 1), 100);
    const page = Math.max(Number(filter.page) || 1, 1);
    const where = and(
      filter.providerId
        ? eq(balanceChecks.providerId, filter.providerId)
        : undefined,
      filter.status ? eq(balanceChecks.status, filter.status) : undefined,
      filter.from ? gte(balanceChecks.checkedAt, filter.from) : undefined,
      filter.to ? lte(balanceChecks.checkedAt, filter.to) : undefined,
    );

    const [data, totalResult] = await Promise.all([
      this.conn
        .select()
        .from(balanceChecks)
        .where(where)
        .orderBy(desc(balanceChecks.checkedAt))
        .limit(limit)
        .offset((page - 1) * limit) as Promise<BalanceCheckEntity[]>,
      this.conn.select({ value: count() }).from(balanceChecks).where(where),
    ]);

    const total = Number(totalResult[0]?.value || 0);
    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async series(
    providerIds: string[],
    from: Date,
    bucketSeconds: number,
  ): Promise<BalancePoint[]> {
    if (providerIds.length === 0) return [];
    /** Số nguyên do server chọn; ghi thẳng vào SQL để GROUP BY và ORDER BY là cùng một biểu thức. */
    const size = sql.raw(String(Math.max(1, Math.floor(bucketSeconds))));
    const bucket = sql<number>`floor(extract(epoch from ${balanceChecks.checkedAt}) / ${size})`;
    const rows = await this.conn
      .select({
        providerId: balanceChecks.providerId,
        at: sql<Date>`max(${balanceChecks.checkedAt})`.mapWith(
          balanceChecks.checkedAt,
        ),
        balance: sql<string>`(array_agg(${balanceChecks.balance} order by ${balanceChecks.checkedAt} desc))[1]`,
      })
      .from(balanceChecks)
      .where(
        and(
          inArray(balanceChecks.providerId, providerIds),
          eq(balanceChecks.status, CheckStatus.SUCCESS),
          gte(balanceChecks.checkedAt, from),
        ),
      )
      .groupBy(balanceChecks.providerId, bucket)
      .orderBy(balanceChecks.providerId, bucket);
    return rows.map((row) => ({
      providerId: row.providerId,
      at: row.at,
      balance: Number(row.balance),
    }));
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = (await this.conn
      .delete(balanceChecks)
      .where(lt(balanceChecks.checkedAt, cutoff))
      .returning({ id: balanceChecks.id })) as unknown[];
    return result.length;
  }
}
