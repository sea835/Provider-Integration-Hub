import { pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '../../../common/base/base.schema';

export const users = pgTable('users', {
    ...baseSchema,
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
});
