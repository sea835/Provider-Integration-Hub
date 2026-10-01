import { SupplierEntity } from '@modules/supplier/domain/supplier.entity';

/** Cấu hình NCC dùng lúc chạy: secret đã giải mã. Không bao giờ trả ra API. */
export type SupplierConfig = Omit<SupplierEntity, 'secretsEnc'> & {
  secrets: Record<string, unknown>;
};

/** Thông tin đủ để quản lý worker, không có secret. */
export type SupplierRuntimeInfo = Pick<
  SupplierEntity,
  'id' | 'code' | 'status' | 'version' | 'concurrency' | 'rateLimitPerMin'
>;
