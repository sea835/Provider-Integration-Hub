import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { transactions } from './transaction.schema';
import { uuidv7 } from 'uuidv7';

export const transactionStepLogs = pgTable('transaction_step_logs', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  transactionId: uuid('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  step: varchar('step', { length: 100 }).notNull(),
  direction: varchar('direction', { length: 50 }).notNull(),
  httpStatus: integer('http_status'),
  durationMs: integer('duration_ms'),
  requestPayload: jsonb('request_payload'),
  responsePayload: jsonb('response_payload'),
  loggedAt: timestamp('logged_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
