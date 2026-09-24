import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, count } from 'drizzle-orm';
import { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import {
  PaginationQueryDto,
  PaginationMeta,
  PaginatedResult,
} from '@common/base/pagination.dto';

export { PaginationQueryDto, PaginatedResult };
export type { PaginationMeta };

export interface TableWithId extends PgTable {
  id: PgColumn<any>;
}

export abstract class BaseRepository<T> {
  constructor(
    protected readonly db: NodePgDatabase,
    protected readonly table: TableWithId,
  ) {}

  protected getOrderColumn(): PgColumn {
    const tableAny = this.table as unknown as Record<string, unknown>;
    if (tableAny.createdAt && typeof tableAny.createdAt === 'object') {
      return tableAny.createdAt as PgColumn;
    }
    return this.table.id;
  }

  async create(data: Partial<T>): Promise<T> {
    const result = (await this.db
      .insert(this.table)
      .values(data as Record<string, unknown>)
      .returning()) as T[];
    return result[0];
  }

  async findById(id: string): Promise<T | null> {
    const result = (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))) as T[];
    return result[0] || null;
  }

  async findAll(params?: PaginationQueryDto): Promise<T[]> {
    const limit = Math.min(Math.max(Number(params?.limit) || 20, 1), 100);
    const page = Math.max(Number(params?.page) || 1, 1);
    const offset = (page - 1) * limit;
    const orderCol = this.getOrderColumn();

    const result = (await this.db
      .select()
      .from(this.table)
      .orderBy(desc(orderCol))
      .limit(limit)
      .offset(offset)) as T[];
    return result;
  }

  async findPaginated(
    params?: PaginationQueryDto,
  ): Promise<PaginatedResult<T>> {
    const limit = Math.min(Math.max(Number(params?.limit) || 20, 1), 100);
    const page = Math.max(Number(params?.page) || 1, 1);
    const offset = (page - 1) * limit;
    const orderCol = this.getOrderColumn();

    const [data, totalCountResult] = await Promise.all([
      this.db
        .select()
        .from(this.table)
        .orderBy(desc(orderCol))
        .limit(limit)
        .offset(offset) as Promise<T[]>,
      this.db.select({ value: count() }).from(this.table),
    ]);

    const total = Number(totalCountResult[0]?.value || 0);
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

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const result = (await this.db
      .update(this.table)
      .set(data as Record<string, unknown>)
      .where(eq(this.table.id, id))
      .returning()) as T[];
    return result[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = (await this.db
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning()) as unknown[];
    return result.length > 0;
  }
}
