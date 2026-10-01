import {
  boolean,
  char,
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
import { baseSchema } from '@common/base/base.schema';
import { merchants } from '@modules/merchant/infrastructure/merchant.schema';
import { suppliers } from '@modules/supplier/infrastructure/supplier.schema';
import type { OrderDelivery } from '@modules/provider-adapter/domain/supplier-result';

export const transactions = pgTable(
  'transactions',
  {
    ...baseSchema,
    status: varchar('status', { length: 30 }).notNull(),
    transCode: varchar('trans_code', { length: 40 }).notNull().unique(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    partnerTransId: varchar('partner_trans_id', { length: 64 }).notNull(),
    requestHash: char('request_hash', { length: 64 }).notNull(),
    action: varchar('action', { length: 30 }).notNull(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    supplierCode: varchar('supplier_code', { length: 50 }).notNull(),
    packageCode: varchar('package_code', { length: 100 }).notNull(),
    configVersion: integer('config_version').notNull(),
    phone: varchar('phone', { length: 15 }),
    serial: varchar('serial', { length: 30 }),
    supplierTransId: varchar('supplier_trans_id', { length: 100 }),
    submitCount: integer('submit_count').notNull().default(0),
    checkCount: integer('check_count').notNull().default(0),
    resubmitRequested: boolean('resubmit_requested').notNull().default(false),
    nextCheckAt: timestamp('next_check_at', { withTimezone: true }),
    delivery: jsonb('delivery').$type<OrderDelivery>().notNull().default({}),
    errorCode: varchar('error_code', { length: 50 }),
    errorMessage: text('error_message'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('transactions_merchant_request_uq').on(
      t.merchantId,
      t.partnerTransId,
    ),
    index('transactions_supplier_trans_idx').on(
      t.supplierId,
      t.supplierTransId,
    ),
    index('transactions_status_next_check_idx').on(t.status, t.nextCheckAt),
  ],
);
