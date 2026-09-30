import {
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { baseSchema } from '@common/base/base.schema';

export const transactions = pgTable('transactions', {
  ...baseSchema,
  transCode: varchar('trans_code', { length: 64 }).notNull().unique(),
  partnerTransId: varchar('partner_trans_id', { length: 100 }).notNull(),
  supplierTransId: varchar('supplier_trans_id', { length: 100 }),
  supplierId: uuid('supplier_id'),
  variantId: uuid('variant_id'),
  providerCode: varchar('provider_code', { length: 50 })
    .default('ANISIM')
    .notNull(),
  packageCode: varchar('package_code', { length: 100 }).notNull(),
  action: varchar('action', { length: 30 }).notNull(),
  targetPhone: varchar('target_phone', { length: 20 }),
  serial: varchar('serial', { length: 50 }),
  amount: numeric('amount').default('0'),
  costAmount: numeric('cost_amount').default('0'),
  errorCode: varchar('error_code', { length: 50 }),
  errorMessage: text('error_message'),
  lpaString: text('lpa_string'),
  qrUrl: varchar('qr_url', { length: 500 }),
  completedAt: timestamp('completed_at'),
});
