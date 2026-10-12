import { BaseEntity } from '@common/base/base.entity';
import {
  ProviderConfig,
  ProviderSamples,
} from '@modules/provider/domain/provider-config';

export class ProviderEntity extends BaseEntity {
  code: string;
  name: string;
  config: ProviderConfig;
  samples: ProviderSamples | null;
  /** Chuỗi đã mã hoá bằng SecretCipherPort; null = chưa có bí mật nào. */
  encryptedSecrets: string | null;
  unitMultiplier: number;
  intervalMinutes: number;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  cooldownMinutes: number;
  currentBalance: number | null;
  /** Mức cảnh báo số dư ĐÃ GỬI gần nhất (trạng thái của bộ cảnh báo, không phải mức hiển thị). */
  alertLevel: string;
  alertSentAt: Date | null;
  consecutiveFailures: number;
  lastCheckedAt: Date | null;
  lastStatus: string | null;
}
