import {numeric, pgTable, varchar} from "drizzle-orm/pg-core";
import {baseSchema} from "@common/base/base.schema";

export const transactions = pgTable('transactions',{
    ...baseSchema,
    transCode: varchar('transCode', { length: 20 }).notNull(),
    partnerTransId: varchar('partnerTransId', { length: 20 }),
    supplierTransId: varchar('supplierTransId', { length: 20 }),
    supplierId: varchar('supplierId', { length: 20 }),
    variantId: varchar('variantId', { length: 20 }),
    action: varchar('action', { length: 20 }).notNull(), // BUY_DATA | TOPUP | ACTIVATE_SIM | CANCEL_PACKAGE
    targetPhone: varchar('targetPhone', { length: 11 }).notNull(),
    serial: varchar('serial', { length: 20 }).notNull(),
    amount: numeric('amount').notNull(),
    costAmount: numeric('amount').notNull(),
    errorCode: varchar('errorCode', { length: 10 }),
    errorMessage: varchar('errorMessage', { length: 255 }),
})
