import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { SupplierSettingEntity } from './supplier-setting.entity';

export abstract class SupplierSettingRepositoryPort extends BaseRepositoryPort<SupplierSettingEntity> {
  abstract findBySupplierId(
    supplierId: string,
  ): Promise<SupplierSettingEntity | null>;
}
