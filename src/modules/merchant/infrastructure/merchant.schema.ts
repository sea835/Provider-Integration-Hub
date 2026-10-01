import { char, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '@common/base/base.schema';

export const merchants = pgTable('merchants', {
  ...baseSchema,
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  apiKeyHash: char('api_key_hash', { length: 64 }).notNull().unique(),
  apiKeyLast4: varchar('api_key_last4', { length: 4 }).notNull(),
  ipWhitelist: jsonb('ip_whitelist').$type<string[]>().notNull().default([]),
});
