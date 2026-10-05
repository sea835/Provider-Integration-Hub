import { TokenStorePort } from '@modules/provider-adapter/domain/token-store.port';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';

export class MemoryTokenStore extends TokenStorePort {
  readonly values = new Map<string, string>();
  private readonly locks = new Set<string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }

  lock(key: string): Promise<boolean> {
    if (this.locks.has(key)) return Promise.resolve(false);
    this.locks.add(key);
    return Promise.resolve(true);
  }

  unlock(key: string): Promise<void> {
    this.locks.delete(key);
    return Promise.resolve();
  }
}

export class PlainCipher extends SecretCipherPort {
  encrypt(value: Record<string, unknown>): string {
    return JSON.stringify(value);
  }

  decrypt(payload: string): Record<string, unknown> {
    return JSON.parse(payload) as Record<string, unknown>;
  }
}
