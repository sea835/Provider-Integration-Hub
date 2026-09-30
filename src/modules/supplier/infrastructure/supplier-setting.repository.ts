import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { SupplierSettingEntity } from '../domain/supplier-setting.entity';
import { SupplierSettingRepositoryPort } from '../domain/supplier-setting.repository.port';
import { supplierSettings } from './supplier-setting.schema';

@Injectable()
export class SupplierSettingRepository
  extends BaseRepository<SupplierSettingEntity>
  implements SupplierSettingRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, supplierSettings);
  }

  async findBySupplierId(
    supplierId: string,
  ): Promise<SupplierSettingEntity | null> {
    const rows = (await this.db
      .select()
      .from(supplierSettings)
      .where(
        eq(supplierSettings.supplierId, supplierId),
      )) as unknown as SupplierSettingEntity[];
    return rows[0] || null;
  }
}
