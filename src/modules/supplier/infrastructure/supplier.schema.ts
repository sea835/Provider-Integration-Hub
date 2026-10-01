import { pgTable, varchar, integer, text, jsonb } from 'drizzle-orm/pg-core';
import { baseSchema } from '@common/base/base.schema';

export const suppliers = pgTable('suppliers', {
  ...baseSchema,
  status: varchar('status', { length: 20 }).notNull().default('PAUSED'),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  adapterType: varchar('adapter_type', { length: 30 }).notNull(),
  version: integer('version').notNull().default(1),
  baseUrl: varchar('base_url', { length: 500 }).notNull(),
  submitTimeoutMs: integer('submit_timeout_ms').notNull().default(30000),
  queryTimeoutMs: integer('query_timeout_ms').notNull().default(10000),
  concurrency: integer('concurrency').notNull().default(5),
  rateLimitPerMin: integer('rate_limit_per_min').notNull().default(60),
  pollScheduleSec: jsonb('poll_schedule_sec')
    .$type<number[]>()
    .notNull()
    .default([5, 10, 20, 40, 60, 120, 300, 900, 1800, 3600]),
  maxWaitSec: integer('max_wait_sec').notNull().default(86400),
  maxResubmit: integer('max_resubmit').notNull().default(2),
  callbackIpWhitelist: jsonb('callback_ip_whitelist')
    .$type<string[]>()
    .notNull()
    .default([]),
  params: jsonb('params')
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  secretsEnc: text('secrets_enc'),
});
