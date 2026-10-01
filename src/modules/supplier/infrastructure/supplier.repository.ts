import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { asc, eq, sql } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { SupplierEntity } from '@modules/supplier/domain/supplier.entity';
import { SupplierRepositoryPort } from '@modules/supplier/domain/supplier.repository.port';
import { suppliers } from '@modules/supplier/infrastructure/supplier.schema';

@Injectable()
export class SupplierRepository
  extends BaseRepository<SupplierEntity>
  implements SupplierRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, suppliers);
  }

  async findByCode(code: string): Promise<SupplierEntity | null> {
    const rows = await this.conn
      .select()
      .from(suppliers)
      .where(eq(suppliers.code, code));
    return (rows[0] as SupplierEntity | undefined) ?? null;
  }

  async listAll(): Promise<SupplierEntity[]> {
    const rows = await this.conn
      .select()
      .from(suppliers)
      .orderBy(asc(suppliers.code));
    return rows as SupplierEntity[];
  }

  async updateWithVersion(
    id: string,
    data: Partial<SupplierEntity>,
  ): Promise<SupplierEntity | null> {
    const rows = await this.conn
      .update(suppliers)
      .set({
        ...(data as Record<string, unknown>),
        version: sql`${suppliers.version} + 1`,
      })
      .where(eq(suppliers.id, id))
      .returning();
    return (rows[0] as SupplierEntity | undefined) ?? null;
  }
}
