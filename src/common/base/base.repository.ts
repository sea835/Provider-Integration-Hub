import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { PgColumn, PgTable } from 'drizzle-orm/pg-core';

export interface TableWithId extends PgTable {
  id: PgColumn<any>;
}

export class PaginationQueryDto {
  page?: number;
  limit?: number;
  [key: string]: unknown;
}

export abstract class BaseRepository<T> {
  constructor(
    protected readonly db: NodePgDatabase,
    protected readonly table: TableWithId,
  ) {}

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

    const result = (await this.db
      .select()
      .from(this.table)
      .limit(limit)
      .offset(offset)) as T[];
    return result;
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
