# Cấu Hình

Danh sách biến môi trường và các giá trị cấu hình đang viết cứng trong code.

---

## 1. Cách Nạp Cấu Hình

- Dự án **không dùng** `@nestjs/config`. Biến được nạp bằng `dotenv.config()` (đọc file `.env` ở thư mục chạy lệnh) tại `main.ts`, `drizzle.provider.ts`, `drizzle.config.ts`, `migrate.ts`, rồi đọc trực tiếp qua `process.env`.
- `dotenv` **không ghi đè** biến đã có sẵn trong môi trường. Biến truyền qua Docker / CI / shell luôn thắng file `.env`.
- `.env` bị loại khỏi git (`.gitignore`) và khỏi Docker build context (`.dockerignore`).
- Chưa có bước kiểm tra cấu hình lúc khởi động, trừ `DATABASE_URL`.

---

## 2. Biến Môi Trường

### Server

| Biến | Mặc định | Mô tả |
|---|---|---|
| `PORT` | `3000` | Cổng HTTP |
| `NODE_ENV` | — | `production` → log dạng JSON và ẩn message lỗi 500. Dockerfile đặt sẵn `production` |

### Database

| Biến | Mặc định | Mô tả |
|---|---|---|
| `DATABASE_URL` | **Bắt buộc** | Chuỗi kết nối PostgreSQL, ví dụ `postgresql://postgres:password@localhost:5432/provider_hub`. Thiếu → app dừng khi khởi động với lỗi `DATABASE_URL environment variable is missing in .env file!` |

### Logging

| Biến | Mặc định | Giá trị |
|---|---|---|
| `LOG_LEVEL` | `info` | `error` \| `warn` \| `info` \| `debug` \| `verbose`. Giá trị lạ → `info` |
| `LOG_FORMAT` | `json` nếu `NODE_ENV=production`, ngược lại `pretty` | `pretty` (có màu khi chạy trong terminal) \| `json` |

### Xác thực

| Biến | Mặc định | Mô tả |
|---|---|---|
| `JWT_SECRET` | ⚠️ Chuỗi viết cứng trong code | Secret ký access token |
| `JWT_EXPIRES_IN_SEC` | `900` | Thời gian sống access token (giây); cũng là `expiresIn` trả cho client |
| `REFRESH_JWT_SECRET` | ⚠️ Chuỗi viết cứng trong code | Secret ký refresh token, phải khác `JWT_SECRET` |
| `REFRESH_EXPIRES_IN_DAYS` | `7` | Thời gian sống refresh token (ngày). **Chưa áp dụng** cho `sessions.expires_at` (luôn 7 ngày) |
| `JWT_EXPIRES_IN` | `15m` | Được đọc nhưng **không dùng** |
| `REFRESH_JWT_EXPIRES_IN` | `7d` | Được đọc nhưng **không dùng** |

> ⚠️ Bốn biến xác thực **không có trong `.env.example`**. Nếu không đặt `JWT_SECRET` / `REFRESH_JWT_SECRET`, app vẫn chạy với secret mặc định nằm công khai trong source code. Bắt buộc đặt ở mọi môi trường ngoài máy cá nhân — xem [SECURITY.md](./SECURITY.md) R3.

Sinh secret ngẫu nhiên:

```bash
openssl rand -base64 48
```

### Giám sát số dư

| Biến | Mặc định | Mô tả |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Redis cho lịch quét (BullMQ) và kho token đăng nhập đối tác. API và worker phải dùng chung |
| `APP_ENCRYPTION_KEY` | **Bắt buộc** | Khoá 32 byte base64 để mã hoá bí mật của đối tác và token đăng nhập |
| `TELEGRAM_BOT_TOKEN` | *(trống)* | Token bot Telegram gửi cảnh báo (dự phòng, xem dưới) |
| `TELEGRAM_CHAT_ID` | *(trống)* | Id nhóm / kênh nhận cảnh báo (dự phòng, xem dưới) |

Kênh Telegram được cấu hình trên giao diện, trang **Kênh thông báo** (lưu ở bảng `alert_channels`, token mã hoá). Hai biến môi trường trên chỉ được dùng khi chưa lưu gì trên trang đó. Chưa cấu hình ở cả hai nơi, hoặc đang tắt kênh, thì hệ thống vẫn quét và ghi lịch sử nhưng không gửi cảnh báo.

Việc quét theo lịch chạy trong tiến trình worker riêng: `npm run start:worker` (dev: `npm run start:worker:dev`, production: `npm run start:worker:prod`). Chỉ chạy API thì đối tác không được quét tự động (job nằm chờ trong hàng đợi cho tới khi có worker); nút Kiểm tra ngay và Thử kết nối vẫn dùng được.

### Tạo ADMIN đầu tiên (chỉ script)

Chỉ lệnh `npm run db:seed:admin` (hoặc `node dist/infrastructure/database/seed-admin.js`) đọc hai biến này — app **không** đọc.

| Biến | Mặc định | Mô tả |
|---|---|---|
| `ADMIN_EMAIL` | **Bắt buộc khi chạy script** | Email tài khoản ADMIN. Chưa tồn tại → tạo mới; đã tồn tại → nâng lên ADMIN, giữ mật khẩu cũ |
| `ADMIN_PASSWORD` | **Bắt buộc khi chạy script** | Mật khẩu (≥ 6 ký tự), chỉ dùng khi tạo mới |

Truyền trực tiếp trên dòng lệnh thay vì lưu vào `.env`:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='ChangeMe123!' npm run db:seed:admin
```

---

## 3. File `.env` Mẫu Cho Local

Khớp với `docker-compose.yml` (mật khẩu Postgres là `password`):

```dotenv
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/provider_hub

# Logger
LOG_LEVEL=debug
LOG_FORMAT=pretty

# Auth
JWT_SECRET=<openssl rand -base64 48>
JWT_EXPIRES_IN_SEC=900
REFRESH_JWT_SECRET=<openssl rand -base64 48>
REFRESH_EXPIRES_IN_DAYS=7
```

> `.env.example` hiện dùng mật khẩu `postgres`, **không khớp** với `docker-compose.yml` (`password`). Sao chép nguyên `.env.example` sẽ gặp lỗi `password authentication failed for user "postgres"`.

---

## 4. Cấu Hình Viết Cứng Trong Code

Các giá trị sau chưa đọc từ biến môi trường. Muốn đổi phải sửa code.

| Cấu hình | Giá trị | Vị trí |
|---|---|---|
| Rate limit mặc định | 100 request / 60 giây / IP | `src/app.module.ts` |
| Rate limit đăng ký, đăng nhập | 10 request / 60 giây / IP | `src/modules/auth/presentation/auth.controller.ts` |
| Pool kết nối DB | `max 20`, idle 30 000 ms, timeout kết nối 5 000 ms | `src/infrastructure/database/drizzle.provider.ts` |
| Hạn session | 7 ngày | `src/modules/auth/application/auth.service.ts` |
| Độ dài tối đa `x-request-id` nhận vào | 128 ký tự | `src/infrastructure/logger/request-id.middleware.ts` |
| Key bị redact trong log | `password`, `token`, `accessToken`, `refreshToken`, `secret`, `authorization`, `apiKey` | `src/infrastructure/logger/logger.config.ts` |
| Phân trang | mặc định 20, tối đa 100 | `src/common/base/pagination.dto.ts`, `base.repository.ts` |
| Độ dài mật khẩu tối thiểu | 6 | DTO trong `modules/*/presentation/dto` |
| Role được phép | `ADMIN`, `USER`, `MANAGER` | `src/modules/user/domain/user-role.ts` |
| Role yêu cầu cho `/users` | `ADMIN` | `src/modules/user/presentation/user.controller.ts` |
| Thời hạn kiểm tra DB của `/health/ready` | 3 000 ms | `src/modules/health/application/health.service.ts` |
| Docker `HEALTHCHECK` | `/health/live`, mỗi 30 giây, timeout 5 giây, chờ khởi động 20 giây, 3 lần thất bại | `Dockerfile` |
| Đường dẫn Swagger | `/docs` (luôn bật) | `src/main.ts` |
| CORS | Cho phép mọi origin | `src/main.ts` |
| Helmet | Tắt Content-Security-Policy | `src/main.ts` |
| Thời gian chờ mỗi lời gọi tới đối tác | 15 000 ms | `src/modules/provider/infrastructure/http-config/http-config.balance-probe.ts` |
| Thử lại khi lỗi mạng tạm thời (timeout, 502/503/504) | 2 lần, sau 5 giây rồi 15 giây | `src/modules/provider/infrastructure/balance-check.queue.ts` |
| Số job quét chạy song song | 5 | `src/modules/provider/infrastructure/balance-check.worker.ts` |
| Trừ hao hạn token đăng nhập đối tác | 60 giây | `src/modules/provider/infrastructure/http-config/http-config.token-manager.ts` |
| Số lần lỗi liên tiếp thì báo lỗi kết nối | 3 | `src/modules/provider/domain/provider-status.ts` |
| Giữ lịch sử kiểm tra | 90 ngày, dọn lúc 03:15 hằng ngày | `provider-status.ts`, `balance-check.queue.ts` |
| Thư mục migration | `./drizzle/migrations` (tương đối với thư mục chạy lệnh) | `drizzle.config.ts`, `migrate.ts` |

---

## 5. Theo Môi Trường

| Biến | Local | CI | Production |
|---|---|---|---|
| `NODE_ENV` | `development` | (không đặt) | `production` |
| `DATABASE_URL` | Postgres trong Docker | Service `postgres` của GitHub Actions | Secret của hạ tầng |
| `LOG_LEVEL` | `debug` | mặc định | `info` |
| `LOG_FORMAT` | `pretty` | mặc định | `json` (mặc định khi production) |
| `JWT_SECRET`, `REFRESH_JWT_SECRET` | Tự sinh | Mặc định trong code (chấp nhận được cho test) | **Bắt buộc**, lưu trong secret manager |
