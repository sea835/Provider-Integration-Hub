export const ProviderStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
} as const;
export type ProviderStatusType =
  (typeof ProviderStatus)[keyof typeof ProviderStatus];
export const PROVIDER_STATUS_VALUES = Object.values(ProviderStatus);

export const AlertLevel = {
  OK: 'OK',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;
export type AlertLevelType = (typeof AlertLevel)[keyof typeof AlertLevel];

export const CheckStatus = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;
export type CheckStatusType = (typeof CheckStatus)[keyof typeof CheckStatus];
export const CHECK_STATUS_VALUES = Object.values(CheckStatus);

/** Chu kỳ quét cho phép (phút). */
export const CHECK_INTERVALS = [5, 15, 30, 60] as const;
export type CheckInterval = (typeof CHECK_INTERVALS)[number];

export const DEFAULT_INTERVAL_MINUTES: CheckInterval = 5;
export const DEFAULT_COOLDOWN_MINUTES = 60;
/** Số lần lỗi liên tiếp thì báo lỗi kết nối. */
export const FAILURE_ALERT_THRESHOLD = 3;
/** Giữ lịch sử kiểm tra trong bao nhiêu ngày. */
export const CHECK_RETENTION_DAYS = 90;

/** Subject CASL (dạng chuỗi, khớp cột `permissions.subject`). */
export const PROVIDER_SUBJECT = 'Provider';
export const BALANCE_CHECK_SUBJECT = 'BalanceCheck';
