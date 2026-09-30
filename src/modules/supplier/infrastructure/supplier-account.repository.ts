import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { SupplierAccountEntity } from '../domain/supplier-account.entity';
import { SupplierAccountRepositoryPort } from '../domain/supplier-account.repository.port';
import { supplierAccounts } from './supplier-account.schema';

@Injectable()
export class SupplierAccountRepository
  extends BaseRepository<SupplierAccountEntity>
  implements SupplierAccountRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, supplierAccounts);
  }

  async findByUsername(
    username: string,
  ): Promise<SupplierAccountEntity | null> {
    const rows = (await this.db
      .select()
      .from(supplierAccounts)
      .where(
        eq(supplierAccounts.username, username),
      )) as unknown as SupplierAccountEntity[];
    return rows[0] || null;
  }

  async findBySupplierId(supplierId: string): Promise<SupplierAccountEntity[]> {
    const rows = (await this.db
      .select()
      .from(supplierAccounts)
      .where(
        eq(supplierAccounts.supplierId, supplierId),
      )) as unknown as SupplierAccountEntity[];
    return rows;
  }
}
