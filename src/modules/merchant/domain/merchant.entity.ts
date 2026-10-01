import { BaseEntity } from '@common/base/base.entity';
import { MerchantStatusType } from '@modules/merchant/domain/merchant-status';

export class MerchantEntity extends BaseEntity {
  declare status: MerchantStatusType;
  code: string;
  name: string;
  apiKeyHash: string;
  apiKeyLast4: string;
  ipWhitelist: string[];
}

/** Merchant đã xác thực qua X-Api-Key, gắn vào request. */
export interface AuthenticatedMerchant {
  id: string;
  code: string;
}
