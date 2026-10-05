import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';
import { transactions } from '@modules/transaction/infrastructure/transaction.schema';
import { merchants } from '@modules/merchant/infrastructure/merchant.schema';

export const storeCallbacks = pgTable(
  'store_callbacks',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    transCode: varchar('trans_code', { length: 40 }).notNull(),
    event: varchar('event', { length: 30 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    lastUrl: varchar('last_url', { length: 1000 }),
    lastHttpStatus: integer('last_http_status'),
    lastDurationMs: integer('last_duration_ms'),
    lastError: text('last_error'),
    lastResponse: text('last_response'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('store_callbacks_status_next_idx').on(t.status, t.nextAttemptAt),
    index('store_callbacks_transaction_idx').on(t.transactionId, t.createdAt),
    index('store_callbacks_merchant_idx').on(t.merchantId, t.createdAt),
  ],
);
