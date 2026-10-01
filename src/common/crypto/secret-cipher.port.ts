/**
 * Mã hoá / giải mã secret của NCC trước khi lưu DB.
 */
export abstract class SecretCipherPort {
  abstract encrypt(value: Record<string, unknown>): string;
  abstract decrypt(payload: string): Record<string, unknown>;
}
