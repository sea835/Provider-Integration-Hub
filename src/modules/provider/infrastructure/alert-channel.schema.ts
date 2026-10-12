import { boolean, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '@common/base/base.schema';

export const alertChannels = pgTable('alert_channels', {
  ...baseSchema,
  type: varchar('type', { length: 30 }).notNull().unique(),
  enabled: boolean('enabled').default(true).notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull(),
  encryptedSecrets: text('encrypted_secrets'),
});
