import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { SupplierEntity } from '@modules/supplier/domain/supplier.entity';

export abstract class SupplierRepositoryPort extends BaseRepositoryPort<SupplierEntity> {
  abstract findByCode(code: string): Promise<SupplierEntity | null>;
  abstract listAll(): Promise<SupplierEntity[]>;
  /** Cập nhật và tăng `version` trong cùng một câu lệnh. */
  abstract updateWithVersion(
    id: string,
    data: Partial<SupplierEntity>,
  ): Promise<SupplierEntity | null>;
}
