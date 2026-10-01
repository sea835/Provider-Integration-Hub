import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * AES-256-GCM. Định dạng lưu: `v1.<iv>.<tag>.<ciphertext>` (base64url).
 * IV ngẫu nhiên cho mỗi lần mã hoá.
 */
export class AesGcmSecretCipher extends SecretCipherPort {
  private readonly key: Buffer;

  constructor(base64Key: string | undefined) {
    super();
    if (!base64Key) {
      throw new Error('APP_ENCRYPTION_KEY chưa được cấu hình');
    }
    const key = Buffer.from(base64Key, 'base64');
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `APP_ENCRYPTION_KEY phải là ${KEY_LENGTH} byte (base64), hiện là ${key.length} byte`,
      );
    }
    this.key = key;
  }

  encrypt(value: Record<string, unknown>): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(payload: string): Record<string, unknown> {
    const [version, iv, tag, ciphertext] = payload.split('.');
    if (version !== VERSION || !iv || !tag || !ciphertext) {
      throw new Error('Chuỗi secret không đúng định dạng');
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plaintext) as Record<string, unknown>;
  }
}
