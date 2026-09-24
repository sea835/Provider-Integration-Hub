# Provider Integration Hub — Tổng Quan Dự Án

Tài liệu mô tả dự án ở mức tổng quan: mục tiêu, phạm vi hiện tại, công nghệ, cấu trúc mã nguồn, các vấn đề đã biết và hướng phát triển. Chi tiết kỹ thuật nằm ở các tài liệu được liên kết ở mục 8.

> Cập nhật lần cuối: 2026-09-24, theo nhánh `feature/auth-module`.

---

## 1. Mục Tiêu

**Provider Integration Hub** là backend NestJS xây theo kiến trúc DDD + Hexagonal.

Dự án đang ở **giai đoạn nền móng**: đã có hạ tầng kỹ thuật (logging, database, xử lý lỗi, validation, rate limit) cùng hai module `user` và `auth`. Các module nghiệp vụ tiếp theo sẽ do team xác định và được xây trên nền này.

> Module `provider` trong [cau-truc-module-hexagonal.md](huong-dan/cau-truc-module-hexagonal.md) và [huong-dan-tao-module.md](huong-dan/huong-dan-tao-module.md) **chỉ là ví dụ minh hoạ** cấu trúc module, không phải hạng mục cần hiện thực.

---

## 2. Trạng Thái Hiện Tại

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Hạ tầng NestJS + kiến trúc Hexagonal | ✅ Có | 4 layer `domain / application / infrastructure / presentation` |
| Database PostgreSQL + Drizzle ORM + migration | ✅ Có | 2 bảng: `users`, `sessions` |
| Logging theo tag + request ID | ✅ Có | `[req:xxx] [LAYER][Context][Component]` |
| Xử lý lỗi tập trung (`GlobalExceptionFilter`) | ✅ Có | Map cả lỗi PostgreSQL sang HTTP |
| Validation request (`class-validator`) | ✅ Có | `ValidationPipe` global, whitelist |
| Swagger UI | ✅ Có | `/docs` |
| Rate limiting | ✅ Có | 100 req/phút/IP, đăng ký/đăng nhập 10 req/phút |
| Module `user` (CRUD người dùng) | ✅ Có | ⚠️ Hiện đang **public**, xem mục 6 |
| Module `auth` (JWT + refresh token + session) | 🟡 Đang làm | Chưa commit, nằm trên nhánh `feature/auth-module` |
| Phân quyền theo role (`@Roles`) | 🟡 Có hạ tầng | Guard đã chạy global nhưng chưa endpoint nào dùng |
| Health check endpoint | ❌ Chưa có | |
| CI (lint, unit test, migrate, e2e, build) | ✅ Có | GitHub Actions |
| Docker image | ✅ Có | Multi-stage, `node:22-alpine` |

---

## 3. Công Nghệ

| Thành phần | Công nghệ | Phiên bản (theo `package.json` / lockfile) |
|---|---|---|
| Runtime | Node.js | 22 (Docker, CI); tối thiểu 20 |
| Framework | NestJS (Express) | 11.x |
| Ngôn ngữ | TypeScript | 5.7 |
| Database | PostgreSQL | 16 |
| ORM / migration | Drizzle ORM / drizzle-kit | 1.0.0-rc.4 |
| Driver | `pg` (node-postgres) | 8.x |
| Validation | `class-validator`, `class-transformer` | |
| Xác thực | `@nestjs/jwt` (HS256) | 11.x |
| Rate limit | `@nestjs/throttler` | 6.7 |
| Bảo mật HTTP | `helmet` | 8.x |
| API docs | `@nestjs/swagger` | 11.x |
| ID | `uuidv7` | |
| Test | Jest 30, Supertest | |
| Lint / format | ESLint 9 (typescript-eslint), Prettier 3 | |

---

## 4. Cấu Trúc Mã Nguồn

```
.
├── src/
│   ├── main.ts                     # Bootstrap: helmet, ValidationPipe, CORS, Swagger
│   ├── app.module.ts               # Ghép module + guard/filter global
│   ├── common/                     # Dùng chung, không phụ thuộc hạ tầng cụ thể
│   │   ├── base/                   # BaseEntity, baseSchema, BaseRepository, BaseService, BaseController, pagination
│   │   ├── filters/                # GlobalExceptionFilter + định dạng lỗi ApiErrorResponse
│   │   └── logger/                 # LoggerPort + LogLayer (port, không có implementation)
│   ├── infrastructure/             # Adapter dùng chung toàn app
│   │   ├── database/               # Drizzle pool/provider, drizzle.config, script migrate
│   │   └── logger/                 # TaggedLoggerAdapter, request id, HTTP access log
│   └── modules/                    # Bounded context
│       ├── user/                   # Quản lý người dùng
│       └── auth/                   # Đăng ký, đăng nhập, refresh token, session
├── drizzle/migrations/             # File migration SQL sinh bởi drizzle-kit
├── test/                           # E2E test (Supertest, cần DB thật)
├── postman/                        # Postman collection (mới có nhóm Users)
├── docs/                           # Tài liệu
├── Dockerfile, docker-compose.yml  # Image production / Postgres local
└── .github/workflows/ci.yml        # CI
```

---

## 5. Lịch Sử Phát Triển

| Ngày | Commit | Nội dung |
|---|---|---|
| 2026-09-23 | `a4d204b` | Khởi tạo dự án NestJS |
| 2026-09-24 | `21a7b62` | Tích hợp Drizzle ORM, base repository, module `user` |
| 2026-09-24 | `044b4de` | Hạ tầng logging Hexagonal, request ID, bridge log NestJS |
| 2026-09-24 | `5696820` | DTO cho `user`, ValidationPipe global, Swagger |
| 2026-09-24 | `5ae0b9c` | Phân trang, GlobalExceptionFilter, helmet, rate limit, CI/CD |
| (chưa commit) | — | Module `auth`, `UserRepositoryPort`, cột `users.role`, bảng `sessions` |

---

## 6. Vấn Đề Đã Biết

Danh sách được rút ra khi đọc code hiện tại, sắp xếp theo mức độ nghiêm trọng. Chi tiết và khuyến nghị xử lý: [SECURITY.md](./SECURITY.md) mục 6.

| # | Mức độ | Vấn đề | Vị trí |
|---|---|---|---|
| 1 | 🔴 Cao | Toàn bộ `/users` (tạo, xem, sửa, xoá) gắn `@Public()` — ai cũng gọi được, kể cả đổi mật khẩu/email người khác | `src/modules/user/presentation/user.controller.ts` |
| 2 | 🔴 Cao | `POST /auth/register` cho client tự chọn `role: "ADMIN"` | `src/modules/auth/presentation/dto/register.request.ts` |
| 3 | 🔴 Cao | JWT secret có giá trị mặc định viết cứng; `.env.example` không có biến JWT → dễ chạy production với secret công khai | `src/modules/auth/infrastructure/config/auth.config.ts` |
| 4 | 🟠 Trung bình | Access token vẫn dùng được sau khi logout cho tới khi hết hạn (guard không kiểm tra session) | `jwt-auth.guard.ts` |
| 5 | 🟠 Trung bình | Tin tuyệt đối header `X-Forwarded-For`; chuỗi IP > 64 ký tự hoặc User-Agent > 500 ký tự làm login/register lỗi 500 | `auth.controller.ts`, `session.schema.ts` |
| 6 | 🟠 Trung bình | CORS mở cho mọi origin | `main.ts` |
| 7 | 🟡 Thấp | Hạn session viết cứng 7 ngày, không theo `REFRESH_EXPIRES_IN_DAYS` | `auth.service.ts` |
| 8 | 🟡 Thấp | Session hết hạn / đã thu hồi không bao giờ bị xoá; `sessions.user_id` chưa có index | `session.schema.ts` |
| 9 | 🟡 Thấp | Mật khẩu Postgres trong `docker-compose.yml` (`password`) khác `.env.example` (`postgres`) | Gốc repo |
| 10 | 🟡 Thấp | Swagger chưa khai báo `addBearerAuth()` → không có nút *Authorize* | `main.ts` |
| 11 | 🟡 Thấp | Image Docker không chạy được `db:migrate` (thiếu `tsx` và `src/`) | `Dockerfile` |
| 12 | ⚪ Kiến trúc | Module `auth` import DTO của tầng presentation và hàm static của `UserService` bên module `user` | `auth.service.ts` |

---

## 7. Hướng Phát Triển Đề Xuất

Thứ tự đề xuất, cần team thống nhất:

1. **Đóng các lỗ hổng mức Cao** (mục 6: #1–#3) trước khi merge `feature/auth-module`.
2. **Commit module `auth`** kèm migration `20260924092202_huge_firebird`; bổ sung nhóm Auth vào Postman collection.
3. **Health check** (`GET /health` kiểm tra kết nối DB) phục vụ Docker/Kubernetes.
4. **Chuẩn hoá cấu hình** bằng một config loader có validate (fail-fast khi thiếu biến bắt buộc).
5. **Dọn session** định kỳ và thêm index cho bảng `sessions`.

---

## 8. Bản Đồ Tài Liệu

| Tài liệu | Nội dung |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Kiến trúc tổng thể, module, vòng đời request, port/adapter, quyết định kiến trúc |
| [API.md](./API.md) | Đặc tả REST API: xác thực, định dạng lỗi, rate limit, từng endpoint |
| [DATABASE.md](./DATABASE.md) | Schema, quan hệ, quy ước cột, lịch sử migration |
| [SECURITY.md](./SECURITY.md) | Luồng xác thực, token, mật khẩu, phân quyền, rủi ro đã biết |
| [CONFIGURATION.md](./CONFIGURATION.md) | Biến môi trường và các cấu hình đang viết cứng trong code |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Cài đặt local, script, quy ước code, kiểm thử |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Docker, CI, migration production, checklist triển khai |
| [cau-truc-module-hexagonal.md](huong-dan/cau-truc-module-hexagonal.md) | Template module Hexagonal đầy đủ (kiến trúc đích; module `provider` trong đó là ví dụ) |
| [huong-dan-tao-module.md](huong-dan/huong-dan-tao-module.md) | Các bước tạo module mới |
| [huong-dan-logging.md](huong-dan/huong-dan-logging.md) | Quy ước log theo tag |
| [huong-dan-migration.md](huong-dan/huong-dan-migration.md) | Quy trình migration với Drizzle |
