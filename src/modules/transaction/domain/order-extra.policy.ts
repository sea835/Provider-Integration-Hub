import { OrderActionType } from '@modules/provider-adapter/domain/order-action';
import {
  extraFieldsFor,
  OrderExtra,
  OrderExtraField,
  OrderExtraValue,
} from '@modules/provider-adapter/domain/order-fields';
import { InvalidOrderRequestError } from '@modules/transaction/domain/transaction.errors';

const MAX_TEXT = 500;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_ITEM = 200;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function blank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

function coerce(field: OrderExtraField, value: unknown): OrderExtraValue {
  const name = `extra.${field.key}`;
  switch (field.type) {
    case 'NUMBER': {
      const num = typeof value === 'string' ? Number(value.trim()) : value;
      if (typeof num !== 'number' || !Number.isFinite(num)) {
        throw new InvalidOrderRequestError(`${name} phải là số`);
      }
      return num;
    }
    case 'DATE': {
      const text = typeof value === 'string' ? value.trim() : '';
      if (!isValidDate(text)) {
        throw new InvalidOrderRequestError(
          `${name} phải là ngày dạng YYYY-MM-DD (vd 2026-10-15)`,
        );
      }
      return text;
    }
    case 'TEXT_LIST': {
      const items = Array.isArray(value) ? value : [value];
      if (
        items.length > MAX_LIST_ITEMS ||
        items.some(
          (item) =>
            typeof item !== 'string' ||
            !item.trim() ||
            item.length > MAX_LIST_ITEM,
        )
      ) {
        throw new InvalidOrderRequestError(
          `${name} phải là danh sách chuỗi không rỗng (tối đa ${MAX_LIST_ITEMS} phần tử, mỗi phần tử ${MAX_LIST_ITEM} ký tự)`,
        );
      }
      return (items as string[]).map((item) => item.trim());
    }
    default: {
      if (typeof value !== 'string' && typeof value !== 'number') {
        throw new InvalidOrderRequestError(`${name} phải là chuỗi`);
      }
      const text = String(value).trim();
      if (text.length > MAX_TEXT) {
        throw new InvalidOrderRequestError(`${name} tối đa ${MAX_TEXT} ký tự`);
      }
      return text;
    }
  }
}

/**
 * Kiểm tra `extra` Store gửi theo khai báo của NCC cho thao tác này: không nhận trường lạ,
 * bắt buộc phải có, đúng kiểu. Trả về giá trị đã chuẩn hoá (bỏ trường rỗng).
 */
export function resolveOrderExtra(
  action: OrderActionType,
  raw: Record<string, unknown> | undefined,
  declared: OrderExtraField[],
): OrderExtra {
  const fields = extraFieldsFor(declared, action);
  const allowed = new Map(fields.map((field) => [field.key, field]));
  const input = raw ?? {};

  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      const known = declared.some((field) => field.key === key);
      throw new InvalidOrderRequestError(
        known
          ? `extra.${key} không dùng cho thao tác ${action}`
          : fields.length > 0
            ? `extra.${key} không có trong các trường nhà cung cấp này nhận (${fields.map((field) => field.key).join(', ')})`
            : `Nhà cung cấp này không nhận trường thêm nào (extra.${key})`,
      );
    }
  }

  const extra: OrderExtra = {};
  for (const field of fields) {
    const value = input[field.key];
    if (blank(value)) {
      if (field.required) {
        throw new InvalidOrderRequestError(
          `Thao tác ${action} bắt buộc có extra.${field.key}${field.label ? ` (${field.label})` : ''}`,
        );
      }
      continue;
    }
    extra[field.key] = coerce(field, value);
  }
  return extra;
}
