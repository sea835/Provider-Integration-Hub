import { BaseEntity } from '@common/base/base.entity';

export class SupplierSettingEntity extends BaseEntity {
  supplierId: string;
  baseUrl: string;
  rateLimitRpm: number;
  timeoutSeconds: number;
  executionMode: string;
  pollingIntervalSec: number;
  maxPollingRetries: number;
  connectionParams?: Record<string, any> | null;
  whitelistIps?: string[] | null;
  callbackWebhookUrl?: string | null;
  declare metadata?: any;
}
