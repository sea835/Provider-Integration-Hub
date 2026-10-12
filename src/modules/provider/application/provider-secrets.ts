import { Injectable } from '@nestjs/common';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';
import { VAR_NAME } from '@modules/provider/domain/provider-config.validation';
import { ProviderConfigInvalidError } from '@modules/provider/domain/provider.errors';

const MAX_SECRET_LENGTH = 4000;

/** Chuỗi = đặt giá trị mới, null = xoá, bỏ qua hoặc chuỗi rỗng = giữ nguyên. */
export type SecretsPatch = Record<string, string | null>;

/** Mã hoá / giải mã và gộp bí mật của đối tác. Giá trị giải mã không bao giờ rời khỏi backend. */
@Injectable()
export class ProviderSecrets {
  constructor(private readonly cipher: SecretCipherPort) {}

  decrypt(encrypted: string | null): Record<string, string> {
    if (!encrypted) return {};
    const secrets: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.cipher.decrypt(encrypted))) {
      if (typeof value === 'string') secrets[key] = value;
    }
    return secrets;
  }

  keys(encrypted: string | null): string[] {
    return Object.keys(this.decrypt(encrypted)).sort();
  }

  merge(
    current: Record<string, string>,
    patch: unknown,
  ): Record<string, string> {
    if (patch === undefined || patch === null) return current;
    if (typeof patch !== 'object' || Array.isArray(patch)) {
      throw new ProviderConfigInvalidError(['secrets phải là đối tượng']);
    }
    const next = { ...current };
    const issues: string[] = [];
    for (const [key, value] of Object.entries(patch as SecretsPatch)) {
      if (!VAR_NAME.test(key)) {
        issues.push(
          `secrets.${key}: tên chỉ gồm chữ, số, gạch dưới và bắt đầu bằng chữ`,
        );
      } else if (value === null) {
        delete next[key];
      } else if (typeof value !== 'string') {
        issues.push(`secrets.${key} phải là chuỗi`);
      } else if (value.length > MAX_SECRET_LENGTH) {
        issues.push(`secrets.${key} dài tối đa ${MAX_SECRET_LENGTH} ký tự`);
      } else if (value !== '') {
        next[key] = value;
      }
    }
    if (issues.length > 0) throw new ProviderConfigInvalidError(issues);
    return next;
  }

  encrypt(secrets: Record<string, string>): string | null {
    return Object.keys(secrets).length > 0
      ? this.cipher.encrypt(secrets)
      : null;
  }
}
