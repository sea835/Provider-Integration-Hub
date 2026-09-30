import { BaseEntity } from '@common/base/base.entity';
import { SupplierStatusType } from '@modules/supplier/domain/supplier-status';

export class SupplierEntity extends BaseEntity {
  declare status: SupplierStatusType;
  code: string;
  name: string;
  adapterType: string;
  version: number;
  baseUrl: string;
  submitTimeoutMs: number;
  checkTimeoutMs: number;
  queryTimeoutMs: number;
  concurrency: number;
  rateLimitPerMin: number;
  pollScheduleSec: number[];
  maxWaitSec: number;
  maxResubmit: number;
  callbackIpWhitelist: string[];
  params: Record<string, unknown>;
  secretsEnc: string | null;
}
