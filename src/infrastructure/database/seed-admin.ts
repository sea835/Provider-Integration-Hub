import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { users } from '@modules/user/infrastructure/user.schema';
import { Role } from '@modules/user/domain/user-role';
import { UserService } from '@modules/user/application/user.service';

dotenv.config();

/**
 * Tạo tài khoản ADMIN đầu tiên (đăng ký công khai luôn là USER).
 * - Email chưa tồn tại → tạo mới với role ADMIN.
 * - Email đã tồn tại   → nâng role lên ADMIN, giữ nguyên mật khẩu.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Thiếu biến môi trường ADMIN_EMAIL hoặc ADMIN_PASSWORD');
  }
  if (password.length < 6) {
    throw new Error('ADMIN_PASSWORD phải có ít nhất 6 ký tự');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const db = drizzle({ client: pool });

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!existing) {
      await db.insert(users).values({
        email,
        password: await UserService.hashPassword(password),
        role: Role.ADMIN,
        status: 'ACTIVE',
      });
      console.log(`Đã tạo tài khoản ADMIN: ${email}`);
    } else if (existing.role !== Role.ADMIN) {
      await db
        .update(users)
        .set({ role: Role.ADMIN })
        .where(eq(users.id, existing.id));
      console.log(`Đã nâng quyền ADMIN cho tài khoản có sẵn: ${email}`);
    } else {
      console.log(`Tài khoản ${email} đã là ADMIN, không thay đổi`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
