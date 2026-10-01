import { createHash } from 'node:crypto';
import { uuidv7 } from 'uuidv7';

/** Mã đơn nội bộ, duy nhất toàn hệ thống, cũng là requestId gửi sang NCC. */
export function newTransCode(): string {
  return `TX${uuidv7().replace(/-/g, '')}`;
}

export interface OrderFingerprint {
  action: string;
  supplierCode: string;
  packageCode: string;
  phone: string | null;
  serial: string | null;
}

/** Hash nội dung đơn để phân biệt gửi lại (cùng hash) với dùng trùng requestId (khác hash). */
export function hashOrderRequest(fp: OrderFingerprint): string {
  const canonical = JSON.stringify({
    action: fp.action,
    packageCode: fp.packageCode,
    phone: fp.phone,
    serial: fp.serial,
    supplierCode: fp.supplierCode,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
