import { pgTable, varchar, uuid, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { baseSchema } from '@common/base/base.schema';

export const roles = pgTable('roles', {
  ...baseSchema,
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
});

export const permissions = pgTable('permissions', {
  ...baseSchema,
  action: varchar('action', { length: 50 }).notNull(),
  subject: varchar('subject', { length: 100 }).notNull(),
  conditions: jsonb('conditions'),
  description: varchar('description', { length: 255 }),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  }),
);
