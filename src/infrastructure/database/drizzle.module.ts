import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import {
  DrizzleProvider,
  DrizzlePoolProvider,
  DRIZZLE,
  DRIZZLE_POOL,
} from '@infrastructure/database/drizzle.provider';
import { TransactionRunnerPort } from '@common/database/transaction-runner.port';
import { DrizzleTransactionRunner } from '@infrastructure/database/drizzle-transaction-runner';

@Global()
@Module({
  providers: [
    DrizzlePoolProvider,
    DrizzleProvider,
    { provide: TransactionRunnerPort, useClass: DrizzleTransactionRunner },
  ],
  exports: [DRIZZLE, DRIZZLE_POOL, TransactionRunnerPort],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor(@Inject(DRIZZLE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
