# Kiến Trúc Hệ Thống

Tài liệu mô tả kiến trúc **đang chạy thực tế** của Provider Integration Hub: cách ghép module, vòng đời một request, các port/adapter, và các cơ chế dùng chung (logging, lỗi, xác thực, rate limit).

Kiến trúc **đích** cho module mới (entity có hành vi, mapper, value object...) được mô tả riêng ở [cau-truc-module-hexagonal.md](huong-dan/cau-truc-module-hexagonal.md). Mục 8 của tài liệu này liệt kê các điểm code hiện tại còn khác với kiến trúc đích.

---

## 1. Tổng Quan

Ứng dụng là một **modular monolith** trên NestJS 11 (Express), mỗi module là một bounded context tổ chức theo **Hexagonal (Ports & Adapters)**:

```
                         ┌─────────────────────── LÕI ────────────────────────┐
 HTTP ─► Controller ─────►  Service ──► Entity                                │
 (adapter vào)           │     │                                              │
                         │     ├──► UserRepositoryPort    ◄── UserRepository    (Drizzle) ─► PostgreSQL
                         │     ├──► SessionRepositoryPort ◄── SessionRepository (Drizzle) ─► PostgreSQL
                         │     ├──► TokenPort             ◄── JwtTokenAdapter   (@nestjs/jwt)
                         │     ├──► DatabaseHealthPort    ◄── DrizzleDatabaseHealthAdapter ─► PostgreSQL (select 1)
                         │     └──► LoggerPort            ◄── TaggedLoggerAdapter ─► stdout/stderr
                         └────────────────────────────────────────────────────┘   (adapter ra)
```

Quy tắc cốt lõi: **mũi tên import luôn chỉ vào trong**. Service chỉ biết port (abstract class), module quyết định adapter nào được cắm vào port.

---

## 2. Các Layer

| Layer | Thư mục | Trách nhiệm | Được import |
|---|---|---|---|
| Domain | `modules/*/domain` | Entity, port (abstract class), value object, domain error | `@common/base` |
| Application | `modules/*/application` | Use case, command, dịch domain error → HTTP exception, ghi log | `domain`, `@common/*` |
| Infrastructure | `modules/*/infrastructure` | Schema Drizzle, repository, adapter gọi thư viện/hệ thống ngoài | `domain`, `@common/*`, `@infrastructure/*` |
| Presentation | `modules/*/presentation` | Controller, DTO request/response, guard, decorator | `application`, `domain` |

Hạ tầng dùng chung toàn app nằm ngoài module:

| Thư mục | Nội dung |
|---|---|
| `src/common/base` | Lớp cơ sở CRUD và `baseSchema` (mục 7) |
| `src/common/filters` | `GlobalExceptionFilter`, interface `ApiErrorResponse` |
| `src/common/logger` | `LoggerPort`, `LogLayer` — chỉ có port |
| `src/infrastructure/database` | Pool `pg`, instance Drizzle, config drizzle-kit, script `migrate.ts`, script `seed-admin.ts` |
| `src/infrastructure/logger` | `TaggedLoggerAdapter`, registry, request id, access log, bridge log của Nest |

---

## 3. Bản Đồ Module

```
AppModule
├── ThrottlerModule.forRoot   (100 req / 60s)
├── LoggerModule      @Global  → LoggerPort, NestLoggerBridge, APP_INTERCEPTOR: HttpLoggingInterceptor
│                              → middleware RequestIdMiddleware cho mọi route
├── DrizzleModule     @Global  → DRIZZLE (NodePgDatabase), DRIZZLE_POOL (pg.Pool)
├── UserModule                 → exports: UserService, UserRepositoryPort
├── AuthModule                 → imports: JwtModule, UserModule
│                              → exports: AuthService, TokenPort, SessionRepositoryPort, JwtAuthGuard, RolesGuard
└── HealthModule               → DatabaseHealthPort (không export gì)

Provider global khai báo trong AppModule:
  APP_FILTER  GlobalExceptionFilter
  APP_GUARD   ThrottlerGuard → JwtAuthGuard → RolesGuard   (chạy theo đúng thứ tự này)
```

### Port → Adapter

| Port | Khai báo tại | Adapter | Đăng ký tại |
|---|---|---|---|
| `LoggerPort` | `common/logger/logger.port.ts` | `TaggedLoggerAdapter` | `LoggerModule` |
| `UserRepositoryPort` | `modules/user/domain` | `UserRepository` | `UserModule` |
| `SessionRepositoryPort` | `modules/auth/domain` | `SessionRepository` | `AuthModule` |
| `TokenPort` | `modules/auth/domain` | `JwtTokenAdapter` | `AuthModule` |
| `DatabaseHealthPort` | `modules/health/domain` | `DrizzleDatabaseHealthAdapter` | `HealthModule` |

Port là **abstract class** để vừa làm hợp đồng vừa làm DI token (interface TypeScript biến mất lúc runtime). `UserModule` giữ thêm alias token chuỗi `'IUserRepository'` (`useExisting: UserRepositoryPort`) cho code cũ.

### Phụ thuộc giữa module

`AuthModule` → `UserModule`:

- `UserRepositoryPort` — tra cứu/tạo user (qua export chính thức của module).
- `UserService.hashPassword` / `verifyPassword` — hàm **static**, import trực tiếp class.
- `UserResponseDto` — DTO của **tầng presentation** module `user`, dùng làm kiểu trả về của `AuthService`.

Hai điểm sau vi phạm quy tắc "chỉ dùng thứ module khác export" và "application không phụ thuộc presentation" — xem mục 8.

Phụ thuộc qua decorator và hằng số (chấp nhận được, chỉ là metadata / giá trị thuần):

- `UserController` dùng `@Roles` của `auth`; `HealthController` dùng `@Public` của `auth`.
- `@Roles`, DTO của `user` và `AuthService` dùng hằng `Role` / kiểu `RoleType` ở `modules/user/domain/user-role.ts` — nguồn duy nhất cho danh sách role.

---

## 4. Vòng Đời Một Request

```
Client
  │
  ▼
[Express] helmet (CSP tắt) → CORS
  │
  ▼
[Middleware] RequestIdMiddleware
  │   lấy x-request-id từ header (≤128 ký tự) hoặc sinh UUIDv7,
  │   set response header, mở AsyncLocalStorage cho phần còn lại của request
  ▼
[Guard 1] ThrottlerGuard      bỏ qua nếu @SkipThrottle(); vượt giới hạn → 429
[Guard 2] JwtAuthGuard        bỏ qua nếu @Public(); không có / sai Bearer token → 401; gắn payload vào req.user
[Guard 3] RolesGuard          bỏ qua nếu không có @Roles(); sai role → 403
  │
  ▼
[Interceptor] HttpLoggingInterceptor (bấm giờ)
  │
  ▼
[Pipe] ValidationPipe          whitelist + forbidNonWhitelisted + transform; sai → 400
  │
  ▼
Controller → Service → Port → Adapter → PostgreSQL / JWT
  │
  ▼
[Interceptor] ghi access log  [HTTP][<Controller>] GET /users 200 12ms
  │
  ▼
Response (JSON)

Bất kỳ exception nào ở các bước trên → GlobalExceptionFilter → JSON ApiErrorResponse
```

> Lỗi ném ra từ guard (401/403/429) xảy ra **trước** interceptor, nên không có dòng access log `[HTTP]` — chỉ có dòng `warn` từ `GlobalExceptionFilter` (`[SYS][GlobalExceptionFilter]`).

---

## 5. Cơ Chế Dùng Chung

### 5.1. Logging

- Mọi code nghiệp vụ inject `LoggerPort` và gắn tag trong constructor: `logger.child(LogLayer.APPLICATION, 'User', UserService.name)`.
- `RequestContext` (AsyncLocalStorage) tự gắn `[req:<id>]` vào mọi dòng log trong request.
- `NestLoggerBridge` đưa log nội bộ của Nest về cùng định dạng, tag `[SYS]`.
- `loggerRegistry` đảm bảo mỗi bộ tag chỉ có một instance.
- Các key nhạy cảm trong `meta` (`password`, `token`, `authorization`...) tự thay bằng `[REDACTED]`.

Quy ước chi tiết: [huong-dan-logging.md](huong-dan/huong-dan-logging.md).

### 5.2. Xử lý lỗi

`GlobalExceptionFilter` (`@Catch()` bắt mọi thứ) chuẩn hoá mọi lỗi về một định dạng (xem [API.md](./API.md) mục 5):

| Nguồn lỗi | HTTP | Ghi chú |
|---|---|---|
| `HttpException` của Nest (kể cả ValidationPipe, guard, throttler) | Theo exception | Giữ `message` (chuỗi hoặc mảng) |
| PostgreSQL `23505` unique_violation | 409 | Parse `detail` thành thông báo tiếng Việt |
| PostgreSQL `23503` foreign_key_violation | 400 | |
| PostgreSQL `22P02` invalid_text_representation (vd. UUID sai) | 400 | |
| PostgreSQL mã khác | 500 | `Database Error` |
| `Error` khác | 500 | Ẩn message khi `NODE_ENV=production` |

Filter đọc mã lỗi ở cả `err.code` lẫn `err.cause.code` (Drizzle bọc lỗi `pg` trong `cause`). Lỗi ≥500 log `error` kèm stack và body request (đã redact); lỗi 4xx log `warn`.

Quy ước: **service là nơi dịch lỗi nghiệp vụ sang HTTP exception**. Repository không ném exception, trả `null` khi không tìm thấy.

### 5.3. Validation

`ValidationPipe` được cài trong `main.ts` với `whitelist`, `forbidNonWhitelisted`, `transform`. Field không khai báo trong DTO → 400. Query string được ép kiểu (`page`, `limit` → number) nhờ `@Type(() => Number)`.

> Pipe khai báo ở `main.ts` (không phải trong `AppModule`), nên E2E test phải tự gọi `app.useGlobalPipes(...)` giống `main.ts`. Helmet và CORS cũng không có trong môi trường E2E.

### 5.4. Xác thực & phân quyền

- `JwtAuthGuard` chạy **global**: mọi route mặc định yêu cầu Bearer access token; mở bằng `@Public()` ở method hoặc class.
- `RolesGuard` chạy global, chỉ có tác dụng khi route (method hoặc class) gắn `@Roles(...)`. Tham số có kiểu `RoleType`, gõ sai tên role sẽ lỗi biên dịch.
- Role được đọc từ **payload JWT** (`req.user.role`), không truy vấn DB → đổi role chỉ có hiệu lực từ access token kế tiếp.
- `@CurrentUser()` / `@CurrentUser('sub')` lấy payload token từ `req.user`.

Ma trận quyền hiện tại:

| Route | Yêu cầu |
|---|---|
| `POST /auth/register`, `/auth/login`, `/auth/refresh`, `GET /health/*` | Public |
| `POST /auth/logout`, `GET /auth/me` | Đăng nhập (mọi role) |
| `/users` (toàn bộ) | Role `ADMIN` — khai báo một lần ở cấp class `UserController` |

Tự đăng ký luôn nhận role `USER`. Tài khoản `ADMIN` đầu tiên tạo bằng `npm run db:seed:admin`; sau đó ADMIN cấp role cho người khác qua `POST/PATCH /users`.

Luồng token, session, refresh rotation: [SECURITY.md](./SECURITY.md).

### 5.5. Rate limit

`ThrottlerGuard` global, lưu đếm **trong bộ nhớ process**, khoá theo IP (`req.ip`). Mặc định 100 req / 60 giây; `register` và `login` ghi đè 10 req / 60 giây bằng `@Throttle`; `HealthController` bỏ qua hoàn toàn bằng `@SkipThrottle()` (probe gọi liên tục từ cùng một IP).

### 5.6. Cấu hình

Không dùng `@nestjs/config`. `dotenv.config()` được gọi ở `main.ts`, `drizzle.provider.ts`, `drizzle.config.ts`, `migrate.ts`; code đọc thẳng `process.env`. Danh sách biến: [CONFIGURATION.md](./CONFIGURATION.md).

### 5.7. Database

Một `pg.Pool` dùng chung (`max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`), bọc bởi Drizzle, inject qua token `DRIZZLE`. `DrizzleModule` đóng pool khi app shutdown (`enableShutdownHooks`). Schema và migration: [DATABASE.md](./DATABASE.md).

### 5.8. Health check

Module `health` theo đúng cấu trúc hexagonal:

```
HealthController (@Public, @SkipThrottle)
  ├─ GET /health/live   → HealthService.getLiveness()     không chạm phụ thuộc ngoài
  └─ GET /health/ready  → HealthService.checkReadiness()
                              └─ DatabaseHealthPort.ping()  ◄── DrizzleDatabaseHealthAdapter: select 1
                                   ├─ OK trong 3 giây   → 200 { status: 'ok', checks: { database: 'up' } }
                                   └─ lỗi / quá 3 giây  → 503 (ServiceUnavailableException, định dạng ApiErrorResponse)
```

Lý do lỗi DB (kể cả lỗi gốc trong `cause`) chỉ ghi log `[APP][Health][HealthService]`, không trả ra response vì endpoint là public. Cách dùng cho Docker/Kubernetes: [DEPLOYMENT.md](./DEPLOYMENT.md) mục 5.

---

## 6. Luồng Nghiệp Vụ Chính

### Đăng nhập

```
AuthController.login
  └─ AuthService.login
       ├─ UserRepositoryPort.findByEmail          không có → 401
       ├─ UserService.verifyPassword (scrypt)     sai → 401 (cùng message, chống dò email)
       ├─ user.status !== 'ACTIVE'                → 403
       └─ createSessionAndIssueTokens
            ├─ sessionId = uuidv7()
            ├─ TokenPort.generateTokens({ sub, email, role, sessionId })
            ├─ hash refresh token (scrypt) → SessionRepositoryPort.create
            └─ trả { accessToken, refreshToken, expiresIn, user }
```

### Làm mới token (refresh token rotation)

```
AuthService.refreshToken
  ├─ TokenPort.verifyRefreshToken         sai chữ ký / hết hạn → 401
  ├─ SessionRepositoryPort.findValidSession(sessionId)   chưa thu hồi và chưa hết hạn, không có → 401
  ├─ so khớp refresh token với refresh_token_hash         lệch → 401
  ├─ user tồn tại và ACTIVE                               không → 403
  ├─ revokeSession(session cũ)
  └─ tạo session mới + cặp token mới
```

---

## 7. Lớp Cơ Sở (`src/common/base`)

| Thành phần | Vai trò | Đang được dùng bởi |
|---|---|---|
| `baseSchema` | Cột chung: `id` (UUIDv7), `status`, `created_at`, `updated_at`, `created_by`, `updated_by`, `metadata` | `users`, `sessions` |
| `BaseEntity` | Kiểu dữ liệu tương ứng `baseSchema` | `UserEntity`, `SessionEntity` |
| `BaseRepository<T>` | CRUD Drizzle: `create`, `findById`, `findAll`, `findPaginated`, `update`, `delete`; sắp xếp `created_at DESC`; `limit` kẹp trong 1–100 | `UserRepository`, `SessionRepository` |
| `BaseService<T>` | CRUD, ném `NotFoundException` khi không thấy | `UserService` |
| `BaseController<T>` | 5 endpoint CRUD nhận `Partial<T>` | **Không còn dùng** — `UserController` tự khai báo endpoint với DTO |
| `PaginationQueryDto`, `PaginatedResult<T>` | Query `page`/`limit` và kết quả phân trang | `GET /users` (chỉ query; response chưa có `meta`) |

> `BaseController` nhận `Partial<T>` và trả nguyên row DB, nên sẽ lộ field nhạy cảm và bỏ qua validation. Không dùng cho module mới.

---

## 8. Khác Biệt So Với Kiến Trúc Đích

| Kiến trúc đích | Hiện tại | Ảnh hưởng |
|---|---|---|
| Entity có hành vi, constructor private, `create()` / `restore()` | Entity chỉ khai báo field; repository ép kiểu row thành entity (`as T`) | Không đặt được luật nghiệp vụ trong entity |
| Mapper row ⇄ entity | Không có | Row DB đi thẳng vào lõi |
| Domain không phụ thuộc framework | `UserRepositoryPort` import `PaginationQueryDto` — class có decorator `class-validator` và `@nestjs/swagger` | Domain gián tiếp phụ thuộc framework |
| Domain error được ném từ domain, service dịch sang HTTP | `auth.errors.ts` đã khai báo nhưng **chưa dùng**; `AuthService` ném thẳng `UnauthorizedException`... | Luật xác thực không tái sử dụng được ngoài HTTP |
| Module chỉ dùng service/port được export | `AuthService` import `UserResponseDto` (presentation) và static method của `UserService` | Application của `auth` phụ thuộc presentation của `user` |
| Hằng số cấu hình tập trung | Hạn session 7 ngày viết cứng trong `AuthService` | Lệch với `REFRESH_EXPIRES_IN_DAYS` |

Hướng xử lý đề xuất: tách hàm băm mật khẩu thành `PasswordHasherPort` (adapter scrypt), để `AuthService` trả một kiểu thuộc application (không phải DTO presentation), chuyển `PaginationQueryDto` khỏi chữ ký của port.

---

## 9. Quyết Định Kiến Trúc Đã Có

| Quyết định | Lý do (theo code / tài liệu hiện có) |
|---|---|
| Hexagonal + DDD theo module | Tách nghiệp vụ khỏi HTTP/DB, test service bằng adapter giả |
| Abstract class làm port và DI token | Interface TS không tồn tại lúc runtime, không làm token được |
| Khoá chính UUIDv7 sinh phía ứng dụng | Có thứ tự thời gian → B-Tree index hiệu quả hơn UUIDv4; id biết trước khi insert |
| Logger qua port + registry theo tag | Tag cố định `[LAYER][Context][Component]`, không tạo instance thừa |
| Request ID qua AsyncLocalStorage | Không phải truyền `requestId` qua tham số |
| Refresh token rotation + lưu hash refresh token trong `sessions` | Thu hồi được từng phiên; lộ DB không lộ refresh token |
| Cùng thông báo lỗi khi sai email hoặc sai mật khẩu | Chống dò email (user enumeration) |
| Guard xác thực global, mở bằng `@Public()` | Mặc định an toàn: quên gắn decorator thì route vẫn được bảo vệ |

---

## 10. Mở Rộng

- **Thêm module mới:** theo [huong-dan-tao-module.md](huong-dan/huong-dan-tao-module.md), nhưng dùng **port abstract class** (như `UserRepositoryPort`) thay cho token chuỗi `'I<Name>Repository'`, và DTO + response DTO riêng thay cho `BaseController`.
- **Gọi hệ thống ngoài (API bên thứ ba):** khai báo port ở `application/`, adapter ở `infrastructure/`, logger tag `[INFRA]`. Không gọi `fetch`/SDK trực tiếp trong service.
- **Endpoint cần quyền:** không gắn `@Public()`; thêm `@Roles(Role.ADMIN)` (hoặc nhiều role: `@Roles(Role.ADMIN, Role.MANAGER)`) ở method hoặc class. `Role` import từ `@modules/user/domain/user-role`, `Roles` từ `@modules/auth/presentation/decorators/roles.decorator`.
- **Thêm role mới:** bổ sung vào `Role` trong `user-role.ts` — validation của DTO và kiểu của `@Roles` tự cập nhật theo. Cột `users.role` là `varchar(50)`, không cần migration.

### Tài liệu cũ cần cập nhật

- `huong-dan/cau-truc-module-hexagonal.md` mục 5.5 ghi "chưa cài `class-validator`" — nay đã cài và bật `ValidationPipe` global.
- `huong-dan/cau-truc-module-hexagonal.md` mục 9 và `huong-dan/huong-dan-tao-module.md` mô tả module `user` inject repository qua token `'IUserRepository'` và dùng `BaseController` — nay đã chuyển sang `UserRepositoryPort` và controller riêng.
