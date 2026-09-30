import {
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

export const supplierAccounts = pgTable('supplier_accounts', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  supplierId: uuid('supplier_id').notNull(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  supplierToken: varchar('supplier_token', { length: 500 }),
  email: varchar('email', { length: 255 }),
  role: varchar('role', { length: 50 }).default('SUPPLIER_USER').notNull(),
  status: integer('status').default(1).notNull(),
  metadata: varchar('metadata', { length: 1000 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
