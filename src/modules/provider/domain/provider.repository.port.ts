import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';

export abstract class ProviderRepositoryPort extends BaseRepositoryPort<ProviderEntity> {
  abstract findByCode(code: string): Promise<ProviderEntity | null>;
  /** Toàn bộ đối tác, sắp theo tên (số lượng nhỏ, không phân trang). */
  abstract listAll(): Promise<ProviderEntity[]>;
  abstract listActive(): Promise<ProviderEntity[]>;
}
