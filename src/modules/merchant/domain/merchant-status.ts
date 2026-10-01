export const MerchantStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type MerchantStatusType =
  (typeof MerchantStatus)[keyof typeof MerchantStatus];

export const MERCHANT_STATUS_VALUES = Object.values(MerchantStatus);
