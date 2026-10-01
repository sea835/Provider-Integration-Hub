import { DomainError, DomainErrorKind } from '@common/errors/domain-error';

export class DuplicateRequestIdError extends DomainError {
  readonly code = 'ERR_DUPLICATE_REQUEST_ID';
  readonly kind = DomainErrorKind.CONFLICT;

  constructor(requestId: string) {
    super(`requestId ${requestId} đã được dùng cho một đơn khác nội dung`);
  }
}

export class OrderNotFoundError extends DomainError {
  readonly code = 'ERR_ORDER_NOT_FOUND';
  readonly kind = DomainErrorKind.NOT_FOUND;

  constructor(ref: string) {
    super(`Không tìm thấy đơn ${ref}`);
  }
}

export class InvalidStateTransitionError extends DomainError {
  readonly code = 'ERR_INVALID_STATE';
  readonly kind = DomainErrorKind.CONFLICT;
}

export class InvalidOrderRequestError extends DomainError {
  readonly code = 'ERR_VALIDATION';
  readonly kind = DomainErrorKind.VALIDATION;
}

export class SupplierUnavailableError extends DomainError {
  readonly code = 'ERR_SUPPLIER_UNAVAILABLE';
  readonly kind = DomainErrorKind.UNPROCESSABLE;

  constructor(supplierCode: string) {
    super(`Nhà cung cấp ${supplierCode} không tồn tại hoặc đang tạm dừng`);
  }
}

export class ActionNotSupportedError extends DomainError {
  readonly code = 'ERR_ACTION_NOT_SUPPORTED';
  readonly kind = DomainErrorKind.UNPROCESSABLE;

  constructor(supplierCode: string, action: string) {
    super(`Nhà cung cấp ${supplierCode} không hỗ trợ thao tác ${action}`);
  }
}

export class CallbackNotSupportedError extends DomainError {
  readonly code = 'ERR_CALLBACK_NOT_SUPPORTED';
  readonly kind = DomainErrorKind.NOT_FOUND;

  constructor(supplierCode: string) {
    super(`Nhà cung cấp ${supplierCode} không nhận callback`);
  }
}

export class CallbackForbiddenError extends DomainError {
  readonly code = 'ERR_FORBIDDEN_IP';
  readonly kind = DomainErrorKind.FORBIDDEN;

  constructor(ip: string) {
    super(`Callback từ IP ${ip} không được chấp nhận`);
  }
}
