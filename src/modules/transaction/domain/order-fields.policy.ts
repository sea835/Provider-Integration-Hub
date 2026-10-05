import { OrderActionType } from '@modules/provider-adapter/domain/order-action';
import {
  ActionFieldRules,
  defaultFieldRules,
} from '@modules/provider-adapter/domain/order-fields';
import { normalizeVnPhone } from '@modules/transaction/domain/msisdn';
import { InvalidOrderRequestError } from '@modules/transaction/domain/transaction.errors';

export interface OrderFieldsInput {
  action: OrderActionType;
  phone?: string | null;
  serial?: string | null;
}

export interface OrderFields {
  phone: string | null;
  serial: string | null;
}

/**
 * Kiểm tra và chuẩn hoá phone/serial theo luật của thao tác.
 * Luật lấy theo từng NCC (cấu hình); không truyền thì dùng mặc định của Hub.
 */
export function resolveOrderFields(
  input: OrderFieldsInput,
  rules: ActionFieldRules = defaultFieldRules()[input.action],
): OrderFields {
  const phone = input.phone ? normalizeVnPhone(input.phone) : null;
  if (input.phone && !phone) {
    throw new InvalidOrderRequestError(
      'Số điện thoại không hợp lệ (cần 10 số, bắt đầu bằng 0 hoặc 84)',
    );
  }
  const serial = input.serial?.trim() || null;

  if (rules.phone === 'REQUIRED' && !phone) {
    throw new InvalidOrderRequestError(
      `Thao tác ${input.action} bắt buộc có số điện thoại`,
    );
  }
  if (rules.serial === 'REQUIRED' && !serial) {
    throw new InvalidOrderRequestError(
      `Thao tác ${input.action} bắt buộc có serial`,
    );
  }
  return { phone, serial };
}
