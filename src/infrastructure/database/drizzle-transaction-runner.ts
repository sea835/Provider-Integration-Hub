import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { TransactionRunnerPort } from '@common/database/transaction-runner.port';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { DbContext } from '@infrastructure/database/db-context';

@Injectable()
export class DrizzleTransactionRunner extends TransactionRunnerPort {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {
    super();
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    if (DbContext.current()) {
      return fn();
    }
    return this.db.transaction((tx) =>
      DbContext.run(tx as unknown as NodePgDatabase, fn),
    );
  }
}
