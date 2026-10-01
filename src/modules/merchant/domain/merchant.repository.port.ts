import { BaseRepositoryPort } from '@common/base/base.repository.port';
import { MerchantEntity } from '@modules/merchant/domain/merchant.entity';

export abstract class MerchantRepositoryPort extends BaseRepositoryPort<MerchantEntity> {
  abstract findByApiKeyHash(hash: string): Promise<MerchantEntity | null>;
}
