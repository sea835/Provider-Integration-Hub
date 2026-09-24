import { pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '@common/base/base.schema';

export const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  MANAGER: 'MANAGER',
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

export const users = pgTable('users', {
  ...baseSchema,
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('USER').notNull(),
});
