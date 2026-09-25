import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import {
  roles,
  permissions,
  rolePermissions,
} from '@modules/authorization/infrastructure/authorization.schema';

dotenv.config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const db = drizzle({ client: pool });

  try {
    const defaultRoles = [
      {
        code: 'ADMIN',
        name: 'Quản trị viên toàn hệ thống',
        description: 'Toàn quyền quản trị và phân quyền',
      },
      {
        code: 'MANAGER',
        name: 'Quản lý nghiệp vụ',
        description: 'Quản lý dữ liệu người dùng và nhà cung cấp',
      },
      {
        code: 'USER',
        name: 'Người dùng thông thường',
        description: 'Người dùng cơ bản trong hệ thống',
      },
    ];

    for (const r of defaultRoles) {
      const [existing] = await db
        .select()
        .from(roles)
        .where(eq(roles.code, r.code));
      if (!existing) {
        await db.insert(roles).values(r);
        console.log(`Đã tạo Role: ${r.code}`);
      }
    }

    const defaultPermissions = [
      {
        action: 'manage',
        subject: 'all',
        description: 'Toàn quyền trên mọi tài nguyên',
      },
      {
        action: 'read',
        subject: 'User',
        description: 'Xem thông tin người dùng',
      },
      {
        action: 'create',
        subject: 'User',
        description: 'Tạo tài khoản người dùng',
      },
      {
        action: 'update',
        subject: 'User',
        description: 'Cập nhật thông tin người dùng',
      },
      {
        action: 'delete',
        subject: 'User',
        description: 'Xóa tài khoản người dùng',
      },
      {
        action: 'read',
        subject: 'Provider',
        description: 'Xem thông tin nhà cung cấp',
      },
      {
        action: 'create',
        subject: 'Provider',
        description: 'Thêm nhà cung cấp mới',
      },
      {
        action: 'update',
        subject: 'Provider',
        description: 'Cập nhật nhà cung cấp',
      },
      {
        action: 'delete',
        subject: 'Provider',
        description: 'Xóa nhà cung cấp',
      },
    ];

    for (const p of defaultPermissions) {
      const [existing] = await db
        .select()
        .from(permissions)
        .where(
          and(
            eq(permissions.action, p.action),
            eq(permissions.subject, p.subject),
          ),
        );
      if (!existing) {
        await db.insert(permissions).values(p);
        console.log(`Đã tạo Permission: ${p.action} on ${p.subject}`);
      }
    }

    const allRoles = await db.select().from(roles);
    const allPerms = await db.select().from(permissions);

    const adminRole = allRoles.find((r) => r.code === 'ADMIN');
    const manageAllPerm = allPerms.find(
      (p) => p.action === 'manage' && p.subject === 'all',
    );

    if (adminRole && manageAllPerm) {
      const [existingMap] = await db
        .select()
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.roleId, adminRole.id),
            eq(rolePermissions.permissionId, manageAllPerm.id),
          ),
        );
      if (!existingMap) {
        await db.insert(rolePermissions).values({
          roleId: adminRole.id,
          permissionId: manageAllPerm.id,
        });
        console.log('Đã gán manage all cho ADMIN');
      }
    }

    const managerRole = allRoles.find((r) => r.code === 'MANAGER');
    if (managerRole) {
      const managerPerms = allPerms.filter(
        (p) =>
          p.action !== 'manage' &&
          p.action !== 'delete' &&
          (p.subject === 'User' || p.subject === 'Provider'),
      );
      for (const p of managerPerms) {
        const [existingMap] = await db
          .select()
          .from(rolePermissions)
          .where(
            and(
              eq(rolePermissions.roleId, managerRole.id),
              eq(rolePermissions.permissionId, p.id),
            ),
          );
        if (!existingMap) {
          await db.insert(rolePermissions).values({
            roleId: managerRole.id,
            permissionId: p.id,
          });
        }
      }
      console.log('Đã gán permissions cho MANAGER');
    }

    const userRole = allRoles.find((r) => r.code === 'USER');
    if (userRole) {
      const userPerms = allPerms.filter(
        (p) => p.action === 'read' && p.subject === 'User',
      );
      for (const p of userPerms) {
        const [existingMap] = await db
          .select()
          .from(rolePermissions)
          .where(
            and(
              eq(rolePermissions.roleId, userRole.id),
              eq(rolePermissions.permissionId, p.id),
            ),
          );
        if (!existingMap) {
          await db.insert(rolePermissions).values({
            roleId: userRole.id,
            permissionId: p.id,
          });
        }
      }
      console.log('Đã gán permissions cho USER');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
