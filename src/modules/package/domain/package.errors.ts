import { DomainError, DomainErrorKind } from '@common/errors/domain-error';

export class PackageSupplierUnavailableError extends DomainError {
  readonly code = 'ERR_SUPPLIER_UNAVAILABLE';
  readonly kind = DomainErrorKind.UNPROCESSABLE;

  constructor(supplierCode: string) {
    super(`Nhà cung cấp ${supplierCode} không tồn tại hoặc đang tạm dừng`);
  }
}

export class FeatureNotSupportedError extends DomainError {
  readonly code = 'ERR_FEATURE_NOT_SUPPORTED';
  readonly kind = DomainErrorKind.UNPROCESSABLE;

  constructor(supplierCode: string, feature: string) {
    super(`Nhà cung cấp ${supplierCode} không có API ${feature}`);
  }
}

export class SupplierCallFailedError extends DomainError {
  readonly code = 'ERR_SUPPLIER_CALL_FAILED';
  readonly kind = DomainErrorKind.UPSTREAM;

  constructor(supplierCode: string, detail: string) {
    super(`Không lấy được dữ liệu từ nhà cung cấp ${supplierCode}: ${detail}`);
  }
}
