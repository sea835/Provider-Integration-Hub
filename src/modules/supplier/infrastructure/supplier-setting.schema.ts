import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

export const supplierSettings = pgTable('supplier_settings', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  supplierId: uuid('supplier_id').notNull(),
  baseUrl: varchar('base_url', { length: 500 }).notNull(),
  rateLimitRpm: integer('rate_limit_rpm').default(60),
  timeoutSeconds: integer('timeout_seconds').default(30),
  executionMode: varchar('execution_mode', { length: 50 }).default(
    'ASYNC_CALLBACK',
  ),
  pollingIntervalSec: integer('polling_interval_sec').default(5),
  maxPollingRetries: integer('max_polling_retries').default(10),
  connectionParams: jsonb('connection_params'),
  whitelistIps: jsonb('whitelist_ips'),
  callbackWebhookUrl: varchar('callback_webhook_url', { length: 500 }),
  metadata: varchar('metadata', { length: 1000 }),
  status: varchar('status', { length: 50 }).default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
