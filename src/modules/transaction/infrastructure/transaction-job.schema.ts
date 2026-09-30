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

export const transactionJobs = pgTable('transaction_jobs', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  transactionId: uuid('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  queueName: varchar('queue_name', { length: 100 }).notNull(),
  jobId: varchar('job_id', { length: 100 }).notNull(),
  executionMode: varchar('execution_mode', { length: 50 }).default(
    'ASYNC_CALLBACK',
  ),
  attemptCount: integer('attempt_count').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(5).notNull(),
  totalDurationMs: integer('total_duration_ms'),
  nextPollAt: timestamp('next_poll_at', { withTimezone: true }),
  lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
  lastRawResponse: jsonb('last_raw_response'),
  status: varchar('status', { length: 50 }).default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
