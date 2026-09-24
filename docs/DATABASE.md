# Cơ Sở Dữ Liệu

Mô tả schema PostgreSQL, quy ước cột, quan hệ giữa các bảng và lịch sử migration. Quy trình tạo/chạy migration: [huong-dan-migration.md](huong-dan/huong-dan-migration.md).

---

## 1. Tổng Quan

| Mục | Giá trị |
|---|---|
| DBMS | PostgreSQL 16 |
| ORM | Drizzle ORM 1.0.0-rc.4, driver `node-postgres` |
| Nguồn schema | `src/modules/**/infrastructure/*.schema.ts` |
| Thư mục migration | `drizzle/migrations/` |
| Bảng lịch sử migration | `drizzle.__drizzle_migrations` (mặc định của Drizzle) |
| Kết nối | Một `pg.Pool` mỗi process: `max 20`, idle 30 giây, timeout kết nối 5 giây |

---

## 2. Quy Ước

### Cột chung (`baseSchema`)

Mọi bảng spread `...baseSchema` (`src/common/base/base.schema.ts`):

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | `uuid` | PK | **UUIDv7 sinh phía ứng dụng** (`$defaultFn`). DB không có default — insert bằng SQL tay phải tự truyền `id` |
| `status` | `varchar(50)` | default `'ACTIVE'`, **cho phép NULL** | |
| `created_at` | `timestamp` | not null, default `now()` | |
| `updated_at` | `timestamp` | not null, default `now()` | Tự cập nhật qua `$onUpdate` **chỉ khi update bằng Drizzle** — không có trigger DB |
| `created_by` | `uuid` | | Chưa được ghi ở đâu |
| `updated_by` | `uuid` | | Chưa được ghi ở đâu |
| `metadata` | `jsonb` | | Dữ liệu mở rộng |

### Đặt tên

- Bảng: số nhiều, `snake_case` (`users`, `sessions`).
- Cột trong DB: `snake_case`; property trong code: `camelCase` (`refresh_token_hash` ↔ `refreshTokenHash`).
- Tên constraint do Drizzle sinh: `<bảng>_<cột>_<bảng đích>_<cột đích>_fkey`.

### Thời gian

Các cột dùng `timestamp` **không có múi giờ** (`timestamp without time zone`). Giá trị được `pg` diễn giải theo múi giờ của process Node. Để tránh lệch giờ, chạy app và DB cùng `TZ=UTC`.

---

## 3. Sơ Đồ Quan Hệ

```
┌──────────────────────┐          ┌──────────────────────────┐
│ users                │          │ sessions                 │
├──────────────────────┤          ├──────────────────────────┤
│ id          uuid  PK │◄────┐    │ id           uuid     PK │
│ email       UNIQUE   │     └────┤ user_id      uuid     FK │  ON DELETE CASCADE
│ password             │   1 : n  │ refresh_token_hash       │
│ role                 │          │ ip_address               │
│ + baseSchema         │          │ user_agent               │
└──────────────────────┘          │ expires_at               │
                                  │ is_revoked               │
                                  │ + baseSchema             │
                                  └──────────────────────────┘
```

---

## 4. Bảng

### 4.1. `users`

Schema: `src/modules/user/infrastructure/user.schema.ts`

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| *baseSchema* | | | Mục 2 |
| `email` | `varchar(255)` | not null, **unique** | Email đăng nhập, phân biệt hoa thường |
| `password` | `varchar(255)` | not null | Hash scrypt dạng `<salt hex>:<hash hex>` — không bao giờ lưu plain text |
| `role` | `varchar(50)` | not null, default `'USER'` | `ADMIN` \| `USER` \| `MANAGER` (hằng `Role` ở `src/modules/user/domain/user-role.ts`; DB không ràng buộc giá trị — validation nằm ở DTO) |

`status` được dùng để chặn đăng nhập: chỉ `ACTIVE` mới đăng nhập/refresh được.

`role` được ghi khi: tự đăng ký (luôn `USER`), ADMIN tạo/sửa qua `/users`, hoặc chạy `npm run db:seed:admin` (tạo mới hoặc nâng một email có sẵn lên `ADMIN`). Script seed ghi thẳng vào bảng bằng Drizzle, không đi qua API.

> Email phân biệt hoa thường: `User@x.com` và `user@x.com` là hai tài khoản khác nhau. Nếu cần không phân biệt, chuẩn hoá về chữ thường trước khi lưu hoặc dùng unique index trên `lower(email)`.

### 4.2. `sessions`

Schema: `src/modules/auth/infrastructure/session.schema.ts`

Mỗi bản ghi là một **phiên đăng nhập** (một refresh token còn sống).

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| *baseSchema* | | | `id` chính là `sessionId` trong JWT |
| `user_id` | `uuid` | not null, FK → `users.id` `ON DELETE CASCADE` | Chủ phiên |
| `refresh_token_hash` | `varchar(255)` | not null | Hash scrypt của refresh token |
| `ip_address` | `varchar(64)` | | IP lúc tạo phiên (từ `X-Forwarded-For` hoặc `req.ip`) |
| `user_agent` | `varchar(500)` | | User-Agent lúc tạo phiên |
| `expires_at` | `timestamp` | not null | Hiện luôn = thời điểm tạo + 7 ngày |
| `is_revoked` | `boolean` | not null, default `false` | `true` khi logout hoặc đã được refresh |

Phiên **hợp lệ** khi: `is_revoked = false` **và** `expires_at > now()`.

Vòng đời:

```
login / register / refresh  ──► INSERT (is_revoked=false)
refresh                     ──► UPDATE is_revoked=true (phiên cũ) + INSERT phiên mới
logout                      ──► UPDATE is_revoked=true
xoá user                    ──► DELETE (cascade)
```

---

## 5. Index Và Hiệu Năng

| Bảng | Index hiện có | Truy vấn thường gặp | Đề xuất |
|---|---|---|---|
| `users` | PK `id`, unique `email` | `WHERE email = ?`, `WHERE id = ?`, `ORDER BY created_at DESC LIMIT/OFFSET` | Index `created_at` khi bảng lớn |
| `sessions` | PK `id` | `WHERE id = ? AND is_revoked = false AND expires_at > now()`, `UPDATE ... WHERE user_id = ?` | **Index `user_id`** (PostgreSQL không tự tạo index cho FK) |

Bảng `sessions` **chỉ tăng**: mỗi lần login/refresh thêm một dòng, không có job xoá phiên đã hết hạn hoặc đã thu hồi. Đề xuất job định kỳ:

```sql
DELETE FROM sessions WHERE expires_at < now() - interval '30 days' OR (is_revoked AND updated_at < now() - interval '30 days');
```

Phân trang dùng `LIMIT/OFFSET` — chậm dần ở trang sâu. Khi cần, chuyển sang phân trang theo con trỏ trên `id` (UUIDv7 có thứ tự thời gian).

---

## 6. Lịch Sử Migration

| Thư mục | Trạng thái git | Nội dung |
|---|---|---|
| `20260924044935_good_thunderbird` | Đã commit | Tạo bảng `users` (chưa có `role`) |
| `20260924092202_huge_firebird` | Đã commit | Tạo bảng `sessions`; thêm cột `users.role`; FK `sessions.user_id → users.id` |

Phân quyền theo role và health check không thay đổi schema (không có migration mới).

Các lệnh:

| Lệnh | Tác dụng |
|---|---|
| `npm run db:generate` | So sánh schema với snapshot, sinh migration mới |
| `npm run db:migrate` | Áp dụng migration chưa chạy (`tsx src/infrastructure/database/migrate.ts`) |
| `npm run db:push` | Đẩy thẳng schema lên DB, **không** sinh migration — chỉ dùng thử nghiệm local |
| `npm run db:studio` | Mở Drizzle Studio xem dữ liệu |
| `npm run db:seed:admin` | Tạo / nâng quyền tài khoản ADMIN từ `ADMIN_EMAIL`, `ADMIN_PASSWORD` (chạy lại nhiều lần an toàn) |

Drizzle không có migration ngược (down). Sửa sai bằng một migration mới — xem [huong-dan-migration.md](huong-dan/huong-dan-migration.md).

---

## 7. Thêm Bảng Mới

1. Tạo `src/modules/<module>/infrastructure/<name>.schema.ts`, spread `...baseSchema`. File phải nằm **trực tiếp** trong `infrastructure/` và có đuôi `.schema.ts`, nếu không drizzle-kit sẽ không thấy.
2. Khai báo FK bằng `.references(() => bang.id, { onDelete: ... })`; cân nhắc thêm index cho cột FK.
3. `npm run db:generate` → đọc lại file SQL → `npm run db:migrate`.
4. Commit cả thư mục migration (gồm `migration.sql` và `snapshot.json`).
