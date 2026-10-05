import type {
  AdapterDescriptor,
  ConnectionTestResult,
  SupplierContext,
} from '@modules/provider-adapter/domain/provider-adapter.port';

/**
 * Thông tin về các adapter đã được biên dịch: validate cấu hình NCC và thử kết nối.
 * Được implement bởi AdapterRegistry (module provider-adapter).
 */
export abstract class AdapterSpecPort {
  abstract types(): string[];
  abstract describe(): AdapterDescriptor[];
  abstract validateConfig(
    adapterType: string,
    params: Record<string, unknown>,
    secrets: Record<string, unknown> | null,
  ): Promise<string[]>;
  abstract testConnection(
    adapterType: string,
    ctx: SupplierContext,
  ): Promise<ConnectionTestResult>;
}
