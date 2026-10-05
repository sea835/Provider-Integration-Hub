import { OrderActionType } from '@modules/provider-adapter/domain/order-action';

export const FIELD_RULES = ['REQUIRED', 'OPTIONAL'] as const;
export type FieldRule = (typeof FIELD_RULES)[number];

/** Store phải gửi những trường nào cho một thao tác. Định dạng SĐT luôn được kiểm tra. */
export interface ActionFieldRules {
  phone: FieldRule;
  serial: FieldRule;
}

export type OrderFieldRules = Record<OrderActionType, ActionFieldRules>;

/** Mặc định của Hub; từng NCC có thể đổi (vd ANI eSIM không cần SĐT lẫn serial). */
export function defaultFieldRules(): OrderFieldRules {
  return {
    BUY_DATA: { phone: 'REQUIRED', serial: 'OPTIONAL' },
    TOPUP: { phone: 'REQUIRED', serial: 'OPTIONAL' },
    ACTIVATE_SIM: { phone: 'OPTIONAL', serial: 'OPTIONAL' },
    CANCEL_PACKAGE: { phone: 'OPTIONAL', serial: 'OPTIONAL' },
  };
}
