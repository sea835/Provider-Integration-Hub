import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  requestId: string;
}

/**
 * Lưu requestId theo từng request (AsyncLocalStorage),
 * để mọi log trong cùng request tự có tag [req:xxx] mà không cần truyền tay.
 */
export class RequestContext {
  private static readonly storage =
    new AsyncLocalStorage<RequestContextStore>();

  static run<T>(store: RequestContextStore, fn: () => T): T {
    return this.storage.run(store, fn);
  }

  static get requestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }
}
