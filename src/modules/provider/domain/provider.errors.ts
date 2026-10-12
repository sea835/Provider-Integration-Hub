import { DomainError, DomainErrorKind } from '@common/errors/domain-error';

export class ProviderNotFoundError extends DomainError {
  readonly code = 'ERR_PROVIDER_NOT_FOUND';
  readonly kind = DomainErrorKind.NOT_FOUND;

  constructor(id: string) {
    super(`Không tìm thấy đối tác ${id}`);
  }
}

export class ProviderCodeTakenError extends DomainError {
  readonly code = 'ERR_PROVIDER_CODE_TAKEN';
  readonly kind = DomainErrorKind.CONFLICT;

  constructor(code: string) {
    super(`Mã đối tác ${code} đã tồn tại`);
  }
}

/** Cấu hình gửi lên sai kiểu / sai giá trị. */
export class ProviderConfigInvalidError extends DomainError {
  readonly code = 'ERR_PROVIDER_CONFIG_INVALID';
  readonly kind = DomainErrorKind.VALIDATION;

  constructor(readonly issues: string[]) {
    super(`Cấu hình không hợp lệ: ${issues.join('; ')}`);
  }
}

/** Cấu hình còn thiếu nên chưa bật quét / chưa kiểm tra được. */
export class ProviderNotReadyError extends DomainError {
  readonly code = 'ERR_PROVIDER_NOT_READY';
  readonly kind = DomainErrorKind.UNPROCESSABLE;

  constructor(readonly issues: string[]) {
    super(`Cấu hình API chưa đủ để kiểm tra số dư: ${issues.join('; ')}`);
  }
}

export class ProviderPausedError extends DomainError {
  readonly code = 'ERR_PROVIDER_PAUSED';
  readonly kind = DomainErrorKind.CONFLICT;

  constructor() {
    super('Đối tác đang tạm dừng, hãy bật lại trước khi kiểm tra số dư');
  }
}

export class ThresholdInvalidError extends DomainError {
  readonly code = 'ERR_PROVIDER_THRESHOLD_INVALID';
  readonly kind = DomainErrorKind.VALIDATION;

  constructor() {
    super('Ngưỡng khẩn cấp phải nhỏ hơn hoặc bằng ngưỡng cảnh báo sớm');
  }
}
