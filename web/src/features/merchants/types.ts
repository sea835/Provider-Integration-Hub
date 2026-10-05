export const MERCHANT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

export interface Merchant {
  id: string;
  code: string;
  name: string;
  status: MerchantStatus;
  apiKeyLast4: string;
  ipWhitelist: string[];
  callbackUrl: string | null;
  callbackEnabled: boolean;
  hasCallbackSecret: boolean;
  callbackSecretLast4: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantWithKey extends Merchant {
  apiKey: string;
}

export interface CreateMerchantInput {
  code: string;
  name: string;
  ipWhitelist: string[];
}

export interface UpdateMerchantInput {
  name?: string;
  status?: MerchantStatus;
  ipWhitelist?: string[];
  callbackUrl?: string | null;
  callbackEnabled?: boolean;
}

export interface MerchantWithCallbackSecret extends Merchant {
  callbackSecret: string;
}

export const STORE_CALLBACK_STATUSES = ["PENDING", "DELIVERED", "FAILED", "SKIPPED"] as const;
export type StoreCallbackStatus = (typeof STORE_CALLBACK_STATUSES)[number];

export interface StoreCallback {
  id: string;
  transCode: string;
  merchantId: string;
  event: string;
  status: StoreCallbackStatus;
  attempts: number;
  nextAttemptAt: string | null;
  lastUrl: string | null;
  lastHttpStatus: number | null;
  lastDurationMs: number | null;
  lastError: string | null;
  lastResponse: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallbackTestResult {
  ok: boolean;
  httpStatus: number | null;
  durationMs: number;
  error: string | null;
  response: string | null;
  url: string;
  eventId: string;
}
