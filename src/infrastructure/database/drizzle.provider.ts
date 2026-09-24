import { Provider } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

export const DRIZZLE = 'Drizzle';

export const DrizzleProvider: Provider = {
    provide: DRIZZLE,
    useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is missing in .env file!');
        }

        const pool = new Pool({
            connectionString,
        });

        return drizzle({ client: pool });
    },
};

