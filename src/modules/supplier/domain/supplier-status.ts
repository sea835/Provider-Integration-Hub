export const SupplierStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  DISABLED: 'DISABLED',
} as const;

export type SupplierStatusType =
  (typeof SupplierStatus)[keyof typeof SupplierStatus];

export const SUPPLIER_STATUS_VALUES = Object.values(SupplierStatus);
