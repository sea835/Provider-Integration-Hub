import { BaseEntity } from '@common/base/base.entity';
import { MerchantStatusType } from '@modules/merchant/domain/merchant-status';

export class MerchantEntity extends BaseEntity {
  declare status: MerchantStatusType;
  code: string;
  name: string;
  apiKeyHash: string;
  apiKeyLast4: string;
  ipWhitelist: string[];
  /** Hub POST kết quả cuối của đơn về địa chỉ này (khi callbackEnabled). */
  callbackUrl: string | null;
  callbackEnabled: boolean;
  /** Khoá ký HMAC callback, mã hoá AES-GCM. Không bao giờ trả ra ngoài sau lần tạo. */
  callbackSecretEnc: string | null;
  callbackSecretLast4: string | null;
}

/** Cấu hình callback đã giải mã, chỉ dùng nội bộ để gửi. */
export interface MerchantCallbackConfig {
  enabled: boolean;
  url: string | null;
  secret: string | null;
}

/** Merchant đã xác thực qua X-Api-Key, gắn vào request. */
export interface AuthenticatedMerchant {
  id: string;
  code: string;
}
