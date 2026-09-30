import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { SupplierAccountEntity } from './supplier-account.entity';

export abstract class SupplierAccountRepositoryPort extends BaseRepositoryPort<SupplierAccountEntity> {
  abstract findByUsername(
    username: string,
  ): Promise<SupplierAccountEntity | null>;
  abstract findBySupplierId(
    supplierId: string,
  ): Promise<SupplierAccountEntity[]>;
}
