export interface CreateProviderInput {
  code: string;
  name: string;
  intervalMinutes?: number;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  cooldownMinutes?: number;
}

export interface UpdateProviderInput {
  name?: string;
  status?: string;
  intervalMinutes?: number;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  cooldownMinutes?: number;
}

export interface UpdateProviderConfigInput {
  config: unknown;
  secrets?: unknown;
  unitMultiplier?: number;
}

/** `balance`: đăng nhập (nếu bật) rồi gọi API số dư. `login`: chỉ gọi API đăng nhập. */
export type TestScope = 'balance' | 'login';

export interface TestConnectionInput {
  scope?: TestScope;
  /** Có thì dùng bí mật đã lưu của đối tác cho những khoá không nhập lại. */
  providerId?: string;
  config: unknown;
  secrets?: unknown;
  unitMultiplier?: number;
}
