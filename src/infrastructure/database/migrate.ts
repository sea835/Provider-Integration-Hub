import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle({ client: pool });

  console.log('Đang chạy migration...');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('Chạy migration thành công!');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
