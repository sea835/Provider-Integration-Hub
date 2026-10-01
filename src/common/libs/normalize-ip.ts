/** Bỏ tiền tố IPv4-mapped IPv6 (`::ffff:1.2.3.4` → `1.2.3.4`). */
export function normalizeIp(ip: string | undefined | null): string {
  if (!ip) return '';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
