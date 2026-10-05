/**
 * Chuẩn hoá IP trước khi so với whitelist: bỏ tiền tố IPv4-mapped IPv6 (`::ffff:1.2.3.4` → `1.2.3.4`)
 * và coi loopback IPv6 `::1` là `127.0.0.1` (gọi qua `localhost` trên máy dev thường ra `::1`).
 */
export function normalizeIp(ip: string | undefined | null): string {
  if (!ip) return '';
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return v4 === '::1' ? '127.0.0.1' : v4;
}
