import {
  OrderAction,
  OrderActionType,
} from '@modules/provider-adapter/domain/order-action';
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
 * Kiểm tra và chuẩn hoá phone/serial theo action.
 * Ràng buộc riêng của từng NCC (ví dụ SIM vật lý cần serial) do NCC trả lỗi.
 */
export function resolveOrderFields(input: OrderFieldsInput): OrderFields {
  const phone = input.phone ? normalizeVnPhone(input.phone) : null;
  if (input.phone && !phone) {
    throw new InvalidOrderRequestError(
      'Số điện thoại không hợp lệ (cần 10 số, bắt đầu bằng 0 hoặc 84)',
    );
  }

  if (
    (input.action === OrderAction.BUY_DATA ||
      input.action === OrderAction.TOPUP) &&
    !phone
  ) {
    throw new InvalidOrderRequestError(
      `Thao tác ${input.action} bắt buộc có số điện thoại`,
    );
  }

  return { phone, serial: input.serial?.trim() || null };
}
