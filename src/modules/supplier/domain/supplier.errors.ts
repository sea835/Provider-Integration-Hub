import { DomainError, DomainErrorKind } from '@common/errors/domain-error';

export class SupplierNotFoundError extends DomainError {
  readonly code = 'ERR_SUPPLIER_NOT_FOUND';
  readonly kind = DomainErrorKind.NOT_FOUND;

  constructor(ref: string) {
    super(`Không tìm thấy nhà cung cấp ${ref}`);
  }
}

export class InvalidSupplierConfigError extends DomainError {
  readonly code = 'ERR_INVALID_SUPPLIER_CONFIG';
  readonly kind = DomainErrorKind.VALIDATION;

  constructor(readonly issues: string[]) {
    super(`Cấu hình nhà cung cấp không hợp lệ: ${issues.join('; ')}`);
  }
}
