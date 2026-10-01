import { DomainError, DomainErrorKind } from '@common/errors/domain-error';

export class UnknownAdapterTypeError extends DomainError {
  readonly code = 'ERR_UNKNOWN_ADAPTER';
  readonly kind = DomainErrorKind.VALIDATION;

  constructor(type: string) {
    super(`Adapter ${type} chưa được hỗ trợ`);
  }
}

export class InvalidCallbackPayloadError extends DomainError {
  readonly code = 'ERR_INVALID_CALLBACK';
  readonly kind = DomainErrorKind.VALIDATION;
}
