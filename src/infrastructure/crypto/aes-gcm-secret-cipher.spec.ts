import { randomBytes } from 'node:crypto';
import { AesGcmSecretCipher } from '@infrastructure/crypto/aes-gcm-secret-cipher';

describe('AesGcmSecretCipher', () => {
  const key = randomBytes(32).toString('base64');
  const cipher = new AesGcmSecretCipher(key);

  it('mã hoá rồi giải mã ra đúng dữ liệu', () => {
    const secrets = { apiKey: 'ANI SIM_abc', nested: { a: 1 } };
    const payload = cipher.encrypt(secrets);
    expect(payload.startsWith('v1.')).toBe(true);
    expect(payload).not.toContain('ANI SIM_abc');
    expect(cipher.decrypt(payload)).toEqual(secrets);
  });

  it('cùng dữ liệu cho ra chuỗi khác nhau (IV ngẫu nhiên)', () => {
    expect(cipher.encrypt({ a: 1 })).not.toBe(cipher.encrypt({ a: 1 }));
  });

  it('sai khoá thì không giải mã được', () => {
    const other = new AesGcmSecretCipher(randomBytes(32).toString('base64'));
    expect(() => other.decrypt(cipher.encrypt({ a: 1 }))).toThrow();
  });

  it('dữ liệu bị sửa thì không giải mã được (GCM auth tag)', () => {
    const parts = cipher.encrypt({ a: 1 }).split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => cipher.decrypt(parts.join('.'))).toThrow();
  });

  it.each([undefined, '', randomBytes(16).toString('base64')])(
    'khoá không hợp lệ (%s) thì báo lỗi ngay khi khởi tạo',
    (badKey) => {
      expect(() => new AesGcmSecretCipher(badKey)).toThrow();
    },
  );
});
