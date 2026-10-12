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
        description: 'Quản lý dữ liệu người dùng',
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
        description: 'Xem đối tác, số dư và mức cảnh báo',
      },
      {
        action: 'create',
        subject: 'Provider',
        description: 'Thêm đối tác',
      },
      {
        action: 'update',
        subject: 'Provider',
        description:
          'Sửa ngưỡng, chu kỳ quét, tạm dừng / bật và kiểm tra số dư ngay',
      },
      {
        action: 'delete',
        subject: 'Provider',
        description: 'Xóa đối tác',
      },
      {
        action: 'manage',
        subject: 'Provider',
        description: 'Toàn quyền đối tác: cấu hình API, bí mật, thử kết nối',
      },
      {
        action: 'read',
        subject: 'BalanceCheck',
        description: 'Xem lịch sử và biểu đồ số dư',
      },
      {
        action: 'read',
        subject: 'AlertChannel',
        description: 'Xem cấu hình kênh thông báo',
      },
      {
        action: 'update',
        subject: 'AlertChannel',
        description: 'Sửa kênh thông báo Telegram và gửi tin thử',
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

    /** Quyền mặc định của từng vai trò (ADMIN đã có manage all). */
    const roleGrants: Record<string, Array<[string, string]>> = {
      MANAGER: [
        ['read', 'User'],
        ['create', 'User'],
        ['update', 'User'],
        ['read', 'Provider'],
        ['update', 'Provider'],
        ['read', 'BalanceCheck'],
      ],
      USER: [
        ['read', 'User'],
        ['read', 'Provider'],
        ['read', 'BalanceCheck'],
      ],
    };

    for (const [code, grants] of Object.entries(roleGrants)) {
      const role = allRoles.find((r) => r.code === code);
      if (!role) continue;
      for (const [action, subject] of grants) {
        const perm = allPerms.find(
          (p) => p.action === action && p.subject === subject,
        );
        if (!perm) continue;
        const [existingMap] = await db
          .select()
          .from(rolePermissions)
          .where(
            and(
              eq(rolePermissions.roleId, role.id),
              eq(rolePermissions.permissionId, perm.id),
            ),
          );
        if (!existingMap) {
          await db.insert(rolePermissions).values({
            roleId: role.id,
            permissionId: perm.id,
          });
        }
      }
      console.log(`Đã gán permissions cho ${code}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
