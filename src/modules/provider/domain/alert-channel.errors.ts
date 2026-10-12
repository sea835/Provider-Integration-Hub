import { DomainError, DomainErrorKind } from '@common/errors/domain-error';

export class AlertChannelInvalidError extends DomainError {
  readonly code = 'ERR_ALERT_CHANNEL_INVALID';
  readonly kind = DomainErrorKind.VALIDATION;
}
