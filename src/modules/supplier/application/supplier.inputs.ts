import { SupplierStatusType } from '@modules/supplier/domain/supplier-status';

export interface SupplierTuning {
  submitTimeoutMs?: number;
  queryTimeoutMs?: number;
  concurrency?: number;
  rateLimitPerMin?: number;
  pollScheduleSec?: number[];
  maxWaitSec?: number;
  maxResubmit?: number;
  callbackIpWhitelist?: string[];
}

export interface CreateSupplierInput extends SupplierTuning {
  code: string;
  name: string;
  adapterType: string;
  baseUrl: string;
  params?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
}

export interface UpdateSupplierInput extends SupplierTuning {
  name?: string;
  baseUrl?: string;
  status?: SupplierStatusType;
  params?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
}
