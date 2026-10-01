import { createHash, randomBytes } from 'node:crypto';

export interface GeneratedApiKey {
  key: string;
  hash: string;
  last4: string;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Key gốc chỉ trả về một lần; DB chỉ lưu sha256 và 4 ký tự cuối. */
export function generateApiKey(): GeneratedApiKey {
  const key = `pk_${randomBytes(32).toString('base64url')}`;
  return { key, hash: hashApiKey(key), last4: key.slice(-4) };
}
