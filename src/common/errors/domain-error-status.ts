import { HttpStatus } from '@nestjs/common';
import { DomainErrorKindType } from '@common/errors/domain-error';

/** Quy đổi nhóm lỗi nghiệp vụ sang HTTP status (dùng chung cho filter và access log). */
export const DOMAIN_ERROR_STATUS: Record<DomainErrorKindType, HttpStatus> = {
  VALIDATION: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  UNPROCESSABLE: HttpStatus.UNPROCESSABLE_ENTITY,
  UPSTREAM: HttpStatus.BAD_GATEWAY,
};
