import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const LINK_LOCAL_V4 = /^169\.254\./;
const LINK_LOCAL_V6 = /^fe[89ab][0-9a-f]:/i;
const MAPPED_V4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;
const MAPPED_V4_HEX = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;

/** `::ffff:a9fe:101` (dạng URL chuẩn hoá) → `169.254.1.1`. */
function mappedV4(address: string): string {
  const dotted = MAPPED_V4.exec(address)?.[1];
  if (dotted) return dotted;
  const hex = MAPPED_V4_HEX.exec(address);
  if (!hex) return address;
  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

function isBlockedAddress(address: string): boolean {
  const v4 = mappedV4(address);
  return (
    LINK_LOCAL_V4.test(v4) ||
    v4 === '0.0.0.0' ||
    LINK_LOCAL_V6.test(address) ||
    address === '::'
  );
}

/**
 * Chặn đích không phải nhà cung cấp khi admin gọi thử và xem nguyên phản hồi:
 * chỉ http/https, không vào dải link-local (metadata máy chủ cloud 169.254.169.254...).
 * Trả về lý do bị chặn, hoặc null nếu được gọi.
 */
export async function blockedDestination(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Địa chỉ không hợp lệ';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Chỉ gọi được địa chỉ http hoặc https';
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (host.toLowerCase() === 'metadata.google.internal') {
    return 'Không được gọi địa chỉ metadata của máy chủ';
  }
  let addresses: string[];
  try {
    addresses = isIP(host)
      ? [host]
      : (await lookup(host, { all: true })).map((item) => item.address);
  } catch {
    return null;
  }
  return addresses.some(isBlockedAddress)
    ? 'Không được gọi địa chỉ nội bộ của máy chủ (link-local / metadata)'
    : null;
}
