import { AsyncLocalStorage } from 'node:async_hooks';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Giữ DB transaction hiện tại theo từng luồng async,
 * để mọi repository trong cùng `TransactionRunnerPort.run()` dùng chung một transaction.
 */
export class DbContext {
  private static readonly storage = new AsyncLocalStorage<NodePgDatabase>();

  static run<T>(tx: NodePgDatabase, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(tx, fn);
  }

  static current(): NodePgDatabase | undefined {
    return this.storage.getStore();
  }
}
