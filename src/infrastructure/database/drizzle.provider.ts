import { Provider } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

export const DRIZZLE = 'Drizzle';
export const DRIZZLE_POOL = 'DrizzlePool';

export const DrizzlePoolProvider: Provider = {
  provide: DRIZZLE_POOL,
  useFactory: () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is missing in .env file!',
      );
    }

    return new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  },
};

export const DrizzleProvider: Provider = {
  provide: DRIZZLE,
  useFactory: (pool: Pool) => {
    return drizzle({ client: pool });
  },
  inject: [DRIZZLE_POOL],
};
