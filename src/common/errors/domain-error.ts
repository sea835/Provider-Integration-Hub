export const DomainErrorKind = {
  VALIDATION: 'VALIDATION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE: 'UNPROCESSABLE',
} as const;

export type DomainErrorKindType =
  (typeof DomainErrorKind)[keyof typeof DomainErrorKind];

/**
 * Lỗi nghiệp vụ không phụ thuộc HTTP.
 * `code` là mã máy đọc được (ERR_*), `kind` là nhóm ngữ nghĩa để tầng presentation
 * (GlobalExceptionFilter) quy đổi sang HTTP status.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly kind: DomainErrorKindType;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
