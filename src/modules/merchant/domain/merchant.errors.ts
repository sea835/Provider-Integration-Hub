import { DomainError, DomainErrorKind } from '@common/errors/domain-error';

export class MerchantNotFoundError extends DomainError {
  readonly code = 'ERR_MERCHANT_NOT_FOUND';
  readonly kind = DomainErrorKind.NOT_FOUND;

  constructor(ref: string) {
    super(`Không tìm thấy merchant ${ref}`);
  }
}

export class MerchantCallbackNotReadyError extends DomainError {
  readonly code = 'ERR_MERCHANT_CALLBACK_NOT_READY';
  readonly kind = DomainErrorKind.UNPROCESSABLE;

  constructor(reason: string) {
    super(reason);
  }
}

export class InvalidApiKeyError extends DomainError {
  readonly code = 'ERR_UNAUTHORIZED';
  readonly kind = DomainErrorKind.UNAUTHORIZED;

  constructor() {
    super('API key không hợp lệ hoặc merchant đã bị khoá');
  }
}

export class IpNotAllowedError extends DomainError {
  readonly code = 'ERR_FORBIDDEN_IP';
  readonly kind = DomainErrorKind.FORBIDDEN;

  constructor(ip: string) {
    super(`IP ${ip} không được phép truy cập`);
  }
}
