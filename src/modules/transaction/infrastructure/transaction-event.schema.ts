import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';
import { transactions } from '@modules/transaction/infrastructure/transaction.schema';
import { suppliers } from '@modules/supplier/infrastructure/supplier.schema';

export const transactionEvents = pgTable(
  'transaction_events',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id),
    source: varchar('source', { length: 20 }).notNull(),
    type: varchar('type', { length: 30 }).notNull(),
    outcome: varchar('outcome', { length: 20 }),
    fromStatus: varchar('from_status', { length: 30 }),
    toStatus: varchar('to_status', { length: 30 }),
    configVersion: integer('config_version'),
    httpStatus: integer('http_status'),
    durationMs: integer('duration_ms'),
    message: text('message'),
    request: jsonb('request'),
    response: jsonb('response'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('transaction_events_transaction_idx').on(
      t.transactionId,
      t.createdAt,
    ),
  ],
);

export const callbackEvents = pgTable(
  'callback_events',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    eventId: varchar('event_id', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    matchedTransactionId: uuid('matched_transaction_id'),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('callback_events_supplier_event_uq').on(
      t.supplierId,
      t.eventId,
    ),
  ],
);
