import { timestamp, uuid, varchar, jsonb } from 'drizzle-orm/pg-core';
import {uuidv7} from "uuidv7";

export const baseSchema = {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    status: varchar('status', { length: 50 }).default('ACTIVE'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    metadata: jsonb('metadata'),
};
