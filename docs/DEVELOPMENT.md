# Hướng Dẫn Phát Triển

Cài đặt môi trường local, các lệnh thường dùng, quy ước code và cách chạy test.

---

## 1. Yêu Cầu

| Công cụ | Phiên bản |
|---|---|
| Node.js | 22 (giống CI và Docker); tối thiểu 20 |
| npm | Đi kèm Node |
| Docker + Docker Compose | Để chạy PostgreSQL local |

---

## 2. Cài Đặt Lần Đầu

```bash
# 1. Cài dependency (dùng lockfile)
npm ci

# 2. Tạo file môi trường
cp .env.example .env
```

Sửa `.env` trước khi chạy tiếp:

- Đổi mật khẩu trong `DATABASE_URL` thành `password` cho khớp `docker-compose.yml`.
- Thêm `JWT_SECRET`, `REFRESH_JWT_SECRET` (sinh bằng `openssl rand -base64 48`).

File mẫu đầy đủ: [CONFIGURATION.md](./CONFIGURATION.md) mục 3.

```bash
# 3. Khởi động PostgreSQL
docker compose up -d

# 4. Tạo bảng
npm run db:migrate

# 5. Chạy app (watch mode)
npm run start:dev
```

Kiểm tra: mở `http://localhost:3000/docs`. Log khởi động có dạng:

```
INFO    [SYS][RoutesResolver] AuthController {/auth}:
INFO    [SYS][RouterExplorer] Mapped {/auth/login, POST} route
INFO    [SYS][NestApplication] Nest application successfully started
```

---

## 3. Các Lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm run start:dev` | Chạy có watch |
| `npm run start:debug` | Chạy có watch + Node inspector (cổng 9229) |
| `npm run build` | Build ra `dist/` |
| `npm run start:prod` | Chạy bản build `node dist/main` |
| `npm run lint` | ESLint **có tự sửa** (`--fix`) |
| `npm run format` | Prettier cho `src/` và `test/` |
| `npm test` | Unit test |
| `npm run test:watch` | Unit test chế độ watch |
| `npm run test:cov` | Unit test + coverage (ra `coverage/`) |
| `npm run test:e2e` | E2E test (cần DB) |
| `npm run db:generate` | Sinh migration từ schema |
| `npm run db:migrate` | Chạy migration |
| `npm run db:push` | Đẩy schema thẳng lên DB, không sinh migration (chỉ thử nghiệm) |
| `npm run db:studio` | Giao diện xem dữ liệu |
| `npx tsc --noEmit` | Kiểm tra kiểu |

---

## 4. Quy Ước Code

### Import

Dùng alias, không dùng đường dẫn tương đối nhiều cấp:

| Alias | Trỏ tới |
|---|---|
| `@/*` | `src/*` |
| `@common/*` | `src/common/*` |
| `@modules/*` | `src/modules/*` |
| `@infrastructure/*` | `src/infrastructure/*` |

Alias được khai báo ở `tsconfig.json`, và lặp lại trong `moduleNameMapper` của Jest (`package.json` cho unit test, `test/jest-e2e.json` cho E2E). Thêm alias mới phải sửa cả ba chỗ.

### Định dạng

- Prettier: nháy đơn, dấu phẩy cuối (`trailingComma: all`), thụt 2 dấu cách.
- ESLint: `typescript-eslint` recommendedTypeChecked; cho phép `any`; `no-floating-promises` và `no-unsafe-argument` ở mức cảnh báo.

### Kiến trúc và đặt tên

- Tạo module mới: [huong-dan-tao-module.md](huong-dan/huong-dan-tao-module.md), dùng **port abstract class** thay cho token chuỗi (xem [ARCHITECTURE.md](./ARCHITECTURE.md) mục 10).
- Log: [huong-dan-logging.md](huong-dan/huong-dan-logging.md).
- Migration: [huong-dan-migration.md](huong-dan/huong-dan-migration.md).
- Thông báo lỗi trả cho client (validation, nghiệp vụ) viết bằng **tiếng Việt**; comment trong code viết tiếng Việt.
- Controller mới: mỗi request body có DTO riêng với decorator `class-validator` + `@ApiProperty`; response qua response DTO, không trả entity/row DB.
- Endpoint public phải gắn `@Public()` **có chủ đích**; mặc định để trống (được bảo vệ).

### Git

- Nhánh chính: `main`. Nhánh tính năng: `feature/<tên>`.
- CI chạy khi push hoặc mở PR vào `main`, `master`, `develop`.
- Commit theo Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `test: ...`.
- Migration được commit **cùng** thay đổi schema tương ứng.

---

## 5. Kiểm Thử

### Unit test

- File `*.spec.ts` đặt **cạnh file được test** trong `src/`.
- Không cần database. Service được test bằng cách mock port (repository, token, logger).
- Chạy: `npm test`.

Hiện có:

| File | Phạm vi |
|---|---|
| `src/modules/auth/application/auth.service.spec.ts` | Đăng ký, đăng nhập, refresh, logout, profile |
| `src/modules/user/application/user.service.spec.ts` | Băm mật khẩu, CRUD, 404 |
| `src/common/filters/global-exception.filter.spec.ts` | Map HttpException, lỗi validation, lỗi PostgreSQL, lỗi 500 |
| `src/infrastructure/logger/tagged-logger.adapter.spec.ts` | Tag, registry, format, level, redact, request id |

### E2E test

- File `test/*.e2e-spec.ts`, dựng toàn bộ `AppModule` và gọi HTTP qua Supertest.
- **Cần PostgreSQL đang chạy và đã migrate**, đọc `DATABASE_URL` từ `.env`.
- Test tạo dữ liệu thật (email có timestamp để không trùng). `app.e2e-spec.ts` xoá user nó tạo; `auth.e2e-spec.ts` **để lại** user test trong DB.
- `ValidationPipe` phải được cài lại trong `beforeAll` giống `main.ts` — nếu thêm cấu hình global mới vào `main.ts`, nhớ cập nhật E2E.

```bash
docker compose up -d
npm run db:migrate
npm run test:e2e
```

Hiện có:

| File | Phạm vi |
|---|---|
| `test/app.e2e-spec.ts` | CRUD `/users`, định dạng lỗi, `x-request-id` |
| `test/auth.e2e-spec.ts` | register → login → me → refresh → logout |

### Test thủ công

- Swagger UI: `http://localhost:3000/docs` (chưa có nút *Authorize* — xem [PROJECT.md](./PROJECT.md) mục 6).
- Postman: import `postman/*.json` (mới có nhóm Users).
- curl: [API.md](./API.md) mục 11.

---

## 6. Debug

| Cần | Cách |
|---|---|
| Xem thêm chi tiết log | `LOG_LEVEL=debug` trong `.env` |
| Lần theo một request | Lấy header `x-request-id` từ response, lọc log theo `req:<id>` |
| Xem dữ liệu DB | `npm run db:studio` |
| Đặt breakpoint | `npm run start:debug`, attach debugger vào cổng 9229 |

---

## 7. Lỗi Thường Gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `password authentication failed for user "postgres"` | Mật khẩu trong `.env` khác `docker-compose.yml` | Dùng `password` trong `DATABASE_URL` |
| `DATABASE_URL environment variable is missing in .env file!` | Chưa có `.env` hoặc thiếu biến | `cp .env.example .env` rồi sửa |
| `relation "users" does not exist` | Chưa migrate | `npm run db:migrate` |
| `db:generate` không sinh ra thay đổi | File schema không nằm trực tiếp trong `infrastructure/` hoặc không có đuôi `.schema.ts` | Đặt lại đúng chỗ |
| Mọi request trả `401` | Route chưa gắn `@Public()` và không gửi token | Gửi `Authorization: Bearer <token>` hoặc gắn `@Public()` nếu đúng là public |
| `400 property xxx should not exist` | Gửi field không có trong DTO | Bỏ field, hoặc khai báo field trong DTO |
| `Nest can't resolve dependencies of ... (?, LoggerPort)` | Service inject port chưa được `provide` trong module | Thêm `{ provide: XxxPort, useClass: XxxAdapter }` vào module |
| Cổng 5432 đã bị chiếm | Có PostgreSQL khác đang chạy trên máy | Tắt nó, hoặc đổi cổng map trong `docker-compose.yml` và `DATABASE_URL` |
