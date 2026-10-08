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

export const EXTRA_FIELD_TYPES = [
  'TEXT',
  'NUMBER',
  'DATE',
  'TEXT_LIST',
] as const;
export type ExtraFieldType = (typeof EXTRA_FIELD_TYPES)[number];

export const EXTRA_FIELD_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
export const MAX_EXTRA_FIELDS = 20;

/**
 * Trường thêm NCC cần mà Hub không có sẵn (vd ngày kích hoạt eSIM, email, danh sách ICCID).
 * Store gửi trong `extra`, cấu hình dùng qua `{{order.extra.<key>}}`.
 */
export interface OrderExtraField {
  key: string;
  label: string;
  type: ExtraFieldType;
  required: boolean;
  /** Rỗng = áp cho mọi thao tác. */
  actions: OrderActionType[];
  /** Giá trị cho phép (vd viettel, vinaphone); rỗng = không giới hạn. Chỉ áp cho Chữ và Danh sách chữ. */
  options: string[];
  description: string;
}

export type OrderExtraValue = string | number | string[];
export type OrderExtra = Record<string, OrderExtraValue>;

/** action null (vd lấy danh sách gói không kèm thao tác): mọi trường đã khai báo. */
export function extraFieldsFor(
  fields: OrderExtraField[],
  action: OrderActionType | null,
): OrderExtraField[] {
  return fields.filter(
    (field) =>
      !action || field.actions.length === 0 || field.actions.includes(action),
  );
}
