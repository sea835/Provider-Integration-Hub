import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import {
  DrizzleProvider,
  DrizzlePoolProvider,
  DRIZZLE,
  DRIZZLE_POOL,
} from '@infrastructure/database/drizzle.provider';

@Global()
@Module({
  providers: [DrizzlePoolProvider, DrizzleProvider],
  exports: [DRIZZLE, DRIZZLE_POOL],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor(@Inject(DRIZZLE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
