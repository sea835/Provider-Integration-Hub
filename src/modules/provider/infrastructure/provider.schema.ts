import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';
import { baseSchema } from '@common/base/base.schema';
import {
  ProviderConfig,
  ProviderSamples,
} from '@modules/provider/domain/provider-config';
import {
  AlertLevel,
  DEFAULT_COOLDOWN_MINUTES,
  DEFAULT_INTERVAL_MINUTES,
  ProviderStatus,
} from '@modules/provider/domain/provider-status';

const money = (name: string) =>
  numeric(name, { precision: 20, scale: 2, mode: 'number' });

export const providers = pgTable('providers', {
  ...baseSchema,
  status: varchar('status', { length: 50 })
    .default(ProviderStatus.PAUSED)
    .notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  config: jsonb('config').$type<ProviderConfig>().notNull(),
  samples: jsonb('samples').$type<ProviderSamples>(),
  encryptedSecrets: text('encrypted_secrets'),
  unitMultiplier: numeric('unit_multiplier', {
    precision: 20,
    scale: 6,
    mode: 'number',
  })
    .default(1)
    .notNull(),
  intervalMinutes: integer('interval_minutes')
    .default(DEFAULT_INTERVAL_MINUTES)
    .notNull(),
  warningThreshold: money('warning_threshold'),
  criticalThreshold: money('critical_threshold'),
  cooldownMinutes: integer('cooldown_minutes')
    .default(DEFAULT_COOLDOWN_MINUTES)
    .notNull(),
  currentBalance: money('current_balance'),
  alertLevel: varchar('alert_level', { length: 20 })
    .default(AlertLevel.OK)
    .notNull(),
  alertSentAt: timestamp('alert_sent_at'),
  consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
  lastCheckedAt: timestamp('last_checked_at'),
  lastStatus: varchar('last_status', { length: 20 }),
});

export const balanceChecks = pgTable(
  'balance_checks',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull(),
    balance: money('balance'),
    httpStatus: integer('http_status'),
    latencyMs: integer('latency_ms'),
    errorCode: varchar('error_code', { length: 50 }),
    errorMessage: text('error_message'),
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
  },
  (table) => [
    index('balance_checks_provider_checked_idx').on(
      table.providerId,
      table.checkedAt.desc(),
    ),
  ],
);
