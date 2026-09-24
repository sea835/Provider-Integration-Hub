import { pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '@common/base/base.schema';
import { Role } from '@modules/user/domain/user-role';

export const users = pgTable('users', {
  ...baseSchema,
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default(Role.USER).notNull(),
});
