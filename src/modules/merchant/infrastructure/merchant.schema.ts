import {
  boolean,
  char,
  jsonb,
  pgTable,
  text,
  varchar,
} from 'drizzle-orm/pg-core';
import { baseSchema } from '@common/base/base.schema';

export const merchants = pgTable('merchants', {
  ...baseSchema,
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  apiKeyHash: char('api_key_hash', { length: 64 }).notNull().unique(),
  apiKeyLast4: varchar('api_key_last4', { length: 4 }).notNull(),
  ipWhitelist: jsonb('ip_whitelist').$type<string[]>().notNull().default([]),
  callbackUrl: varchar('callback_url', { length: 1000 }),
  callbackEnabled: boolean('callback_enabled').notNull().default(false),
  callbackSecretEnc: text('callback_secret_enc'),
  callbackSecretLast4: varchar('callback_secret_last4', { length: 4 }),
});
