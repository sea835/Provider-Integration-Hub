# Bảo Mật

Mô tả các cơ chế bảo mật đang có: xác thực bằng JWT + session, lưu mật khẩu, phân quyền, rate limit, và các rủi ro đã biết kèm hướng xử lý.

---

## 1. Các Lớp Bảo Vệ

| Lớp | Cơ chế | Vị trí |
|---|---|---|
| HTTP header | `helmet` (tắt Content-Security-Policy để Swagger UI chạy được) | `src/main.ts` |
| CORS | `app.enableCors()` — cho phép **mọi origin** | `src/main.ts` |
| Rate limit | `ThrottlerGuard` global, theo IP | `src/app.module.ts` |
| Xác thực | `JwtAuthGuard` global, mở bằng `@Public()` | `src/modules/auth/presentation/guards/jwt-auth.guard.ts` |
| Phân quyền | `RolesGuard` global, bật bằng `@Roles(...)`; `/users` chỉ `ADMIN` | `src/modules/auth/presentation/guards/roles.guard.ts` |
| Health check | Response không chứa lý do lỗi DB (chỉ ghi log) | `src/modules/health/application/health.service.ts` |
| Input | `ValidationPipe` whitelist + từ chối field lạ | `src/main.ts` |
| Mật khẩu | scrypt + salt ngẫu nhiên, so sánh constant-time | `src/modules/user/application/user.service.ts` |
| Response | `UserResponseDto` chọn field, không bao giờ trả `password` | `src/modules/user/presentation/dto/user.response.ts` |
| Log | Tự redact `password`, `token`, `accessToken`, `refreshToken`, `secret`, `authorization`, `apiKey` trong `meta` | `src/infrastructure/logger/logger.config.ts` |
| Thông báo lỗi | Ẩn message lỗi 500 khi `NODE_ENV=production`; lỗi DB được thay bằng message chung | `src/common/filters/global-exception.filter.ts` |

---

## 2. Token

| | Access token | Refresh token |
|---|---|---|
| Định dạng | JWT HS256 | JWT HS256 |
| Secret | `JWT_SECRET` | `REFRESH_JWT_SECRET` (khác access) |
| Thời gian sống | `JWT_EXPIRES_IN_SEC` (mặc định 900 giây) | `REFRESH_EXPIRES_IN_DAYS` (mặc định 7 ngày) |
| Payload | `sub`, `email`, `role`, `sessionId`, `iat`, `exp` | Giống access token |
| Dùng ở | Header `Authorization: Bearer` | Body của `POST /auth/refresh` |
| Lưu phía server | Không | Hash scrypt trong `sessions.refresh_token_hash` |
| Thu hồi được | Không (hết hạn tự nhiên) | Có (`sessions.is_revoked`) |

Vì hai loại token ký bằng hai secret khác nhau, gửi refresh token vào header `Authorization` (hoặc ngược lại) sẽ bị từ chối.

---

## 3. Luồng Xác Thực

### Đăng nhập / đăng ký

```
Client                       API                                    DB
  │ POST /auth/login           │                                      │
  │ {email, password} ────────►│ tìm user theo email ────────────────►│
  │                            │ verify scrypt (timingSafeEqual)      │
  │                            │ kiểm tra status = ACTIVE             │
  │                            │ sessionId = uuidv7()                 │
  │                            │ ký access + refresh (cùng sessionId) │
  │                            │ INSERT sessions(hash(refresh)) ─────►│
  │◄──── {accessToken, refreshToken, expiresIn, user}                 │
```

### Refresh token rotation

```
Client                       API                                    DB
  │ POST /auth/refresh         │                                      │
  │ {refreshToken} ───────────►│ verify chữ ký bằng REFRESH secret    │
  │                            │ tìm session hợp lệ theo sessionId ──►│
  │                            │ so khớp hash refresh token           │
  │                            │ kiểm tra user còn ACTIVE ───────────►│
  │                            │ revoke session cũ ──────────────────►│
  │                            │ tạo session mới + cặp token mới ────►│
  │◄──── {accessToken mới, refreshToken mới, ...}                     │
```

Mỗi refresh token chỉ dùng được **một lần**. Dùng lại token cũ → `401`.

### Đăng xuất

`POST /auth/logout` thu hồi session có `id = sessionId` trong access token. Nếu token không có `sessionId` (không xảy ra với token do hệ thống hiện tại cấp), toàn bộ session của user bị thu hồi.

---

## 4. Mật Khẩu

| Tham số | Giá trị |
|---|---|
| Thuật toán | `crypto.scrypt` của Node.js (tham số chi phí mặc định: N=16384, r=8, p=1) |
| Salt | 16 byte ngẫu nhiên / mật khẩu |
| Độ dài khoá | 64 byte |
| Định dạng lưu | `<salt hex>:<hash hex>` |
| So sánh | `crypto.timingSafeEqual` |
| Chính sách | Tối thiểu 6 ký tự, không có yêu cầu độ phức tạp |

Mật khẩu được băm ở `UserService.create/update` (qua `/users`) và `AuthService.register`. Refresh token cũng được băm bằng cùng hàm trước khi lưu.

---

## 5. Phân Quyền

- **Mặc định mọi route cần access token.** Mở route public bằng `@Public()` (method hoặc cả controller).
- **Role:** `ADMIN`, `USER`, `MANAGER` — hằng `Role` ở `src/modules/user/domain/user-role.ts`, nguồn duy nhất cho validation DTO và kiểu của `@Roles`.
- Role nằm trong JWT, `RolesGuard` không truy vấn DB → đổi role chỉ có hiệu lực từ access token kế tiếp (tối đa `JWT_EXPIRES_IN_SEC`, mặc định 15 phút).

### Ma trận quyền

| Route | Public | `USER` | `MANAGER` | `ADMIN` |
|---|:-:|:-:|:-:|:-:|
| `POST /auth/register`, `/auth/login`, `/auth/refresh` | ✅ | ✅ | ✅ | ✅ |
| `GET /health/live`, `/health/ready` | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/logout`, `GET /auth/me` | | ✅ | ✅ | ✅ |
| `POST/GET/PATCH/DELETE /users[/:id]` | | | | ✅ |

`MANAGER` hiện có quyền như `USER`; role này để dành cho các endpoint sau này.

### Cấp role

| Cách | Role nhận được |
|---|---|
| `POST /auth/register` (tự đăng ký) | Luôn `USER`. Gửi `role` trong body → `400` |
| `POST /users` (ADMIN tạo) | Theo field `role`, mặc định `USER` |
| `PATCH /users/:id` (ADMIN sửa) | Theo field `role` |
| `npm run db:seed:admin` | `ADMIN` — cách duy nhất để có ADMIN đầu tiên |

`db:seed:admin` đọc `ADMIN_EMAIL`, `ADMIN_PASSWORD` từ biến môi trường: email chưa có → tạo tài khoản ADMIN; email đã có → nâng lên ADMIN, **giữ nguyên mật khẩu cũ**. Truyền biến trực tiếp trên dòng lệnh, không lưu `ADMIN_PASSWORD` trong `.env` dùng chung. Ở production: [DEPLOYMENT.md](./DEPLOYMENT.md) mục 3.

### Giới hạn quyền cho endpoint mới

```ts
import { Roles } from '@modules/auth/presentation/decorators/roles.decorator';
import { Role } from '@modules/user/domain/user-role';

@Roles(Role.ADMIN, Role.MANAGER)   // gắn ở method, hoặc ở class để áp dụng cho cả controller
@Get('reports')
getReports() { ... }
```

- `@Roles` chỉ nhận giá trị kiểu `RoleType` — gõ sai tên role sẽ lỗi biên dịch.
- Lấy thông tin người gọi: `@CurrentUser() user: TokenPayload` hoặc `@CurrentUser('sub') userId: string`.
- Kiểm tra "chính chủ" (ví dụ chỉ được sửa bản ghi của mình) **không** làm được bằng `@Roles` — phải so `currentUser.sub` với chủ bản ghi trong service.

---

## 6. Rủi Ro Đã Biết

### ✅ R1 — Toàn bộ `/users` là public (đã xử lý)

Trước đây `UserController` gắn `@Public()` ở cấp class: người không đăng nhập liệt kê, sửa (kể cả mật khẩu), xoá được mọi user.

**Đã xử lý:** bỏ `@Public()`, gắn `@Roles(Role.ADMIN)` ở cấp class. Người dùng thường xem thông tin của mình qua `GET /auth/me`; endpoint tự đổi mật khẩu chưa có.

### ✅ R2 — Tự đăng ký làm ADMIN (đã xử lý)

Trước đây `RegisterRequestDto` nhận `role` (gồm cả `ADMIN`) từ client.

**Đã xử lý:** bỏ field `role` khỏi DTO và command đăng ký, `AuthService.register` luôn gán `USER`. ADMIN đầu tiên tạo bằng `npm run db:seed:admin`.

### 🔴 R3 — JWT secret mặc định viết cứng

`loadAuthConfig()` dùng chuỗi mặc định khi thiếu `JWT_SECRET` / `REFRESH_JWT_SECRET`. Chuỗi này nằm trong source code, và `.env.example` không liệt kê hai biến này — triển khai theo `.env.example` sẽ chạy với secret công khai, cho phép ai cũng ký được token ADMIN.

**Xử lý:** bỏ giá trị mặc định, ném lỗi khi khởi động nếu thiếu secret (hoặc secret ngắn hơn 32 ký tự); bổ sung các biến vào `.env.example`.

### 🟠 R4 — Access token vẫn dùng được sau logout

`JwtAuthGuard` chỉ kiểm tra chữ ký và hạn, không kiểm tra session; `RolesGuard` đọc role từ token. Sau logout, khi user bị khoá/xoá, hoặc khi ADMIN bị hạ quyền, access token cũ còn hiệu lực (kèm role cũ) tối đa `JWT_EXPIRES_IN_SEC` (15 phút).

**Xử lý (chọn một):** giữ TTL ngắn và chấp nhận; hoặc guard kiểm tra `sessions.is_revoked` theo `sessionId` (thêm 1 query/request, có thể cache).

### 🟠 R5 — Tin tuyệt đối `X-Forwarded-For`

`AuthController` lấy IP từ header `x-forwarded-for` do client gửi. Hệ quả:

- IP lưu trong `sessions` có thể bị giả mạo.
- Header chứa chuỗi dài hơn 64 ký tự (hoặc `User-Agent` dài hơn 500 ký tự) làm INSERT `sessions` lỗi → login/register trả **500**.

Ngoài ra, rate limit dùng `req.ip`; khi chạy sau reverse proxy mà chưa cấu hình `trust proxy`, mọi client dùng chung IP của proxy → chung một hạn mức.

**Xử lý:** cấu hình `app.set('trust proxy', <số hop>)` và chỉ dùng `req.ip`; cắt `userAgent` về 500 ký tự trước khi lưu.

### 🟠 R6 — CORS mở cho mọi origin

`enableCors()` không tham số. Rủi ro thấp khi token nằm ở header (không dùng cookie), nhưng nên giới hạn danh sách origin ở production.

### 🟡 R7 — Không phát hiện tái sử dụng refresh token

Khi một refresh token **đã bị thu hồi** được dùng lại (dấu hiệu token bị đánh cắp), hệ thống chỉ trả 401. Có thể nâng cấp: thu hồi toàn bộ session của user khi phát hiện.

### 🟡 R8 — Đổi mật khẩu / role không thu hồi phiên

`PATCH /users/:id` (ADMIN) đổi mật khẩu hoặc role nhưng các session cũ vẫn refresh được. Nên gọi `revokeAllUserSessions(userId)` khi đổi mật khẩu hoặc hạ role.

### 🟡 R9 — Chính sách mật khẩu yếu, không khoá tài khoản

Tối thiểu 6 ký tự; chống brute-force chỉ dựa vào rate limit 10 lần/phút/IP. Cân nhắc tăng độ dài tối thiểu và giới hạn số lần sai theo tài khoản.

### 🟡 R10 — Email phân biệt hoa thường

`User@x.com` và `user@x.com` là hai tài khoản. Chuẩn hoá email về chữ thường khi đăng ký/đăng nhập.

---

## 7. Checklist Trước Khi Lên Production

- [ ] R3 đã được xử lý.
- [ ] `JWT_SECRET` và `REFRESH_JWT_SECRET` là chuỗi ngẫu nhiên ≥ 32 ký tự, **khác nhau**, không commit vào repo.
- [ ] Đã tạo ADMIN đầu tiên bằng `db:seed:admin` với mật khẩu mạnh; `ADMIN_PASSWORD` không nằm trong file env của server.
- [ ] `NODE_ENV=production` (ẩn chi tiết lỗi 500, log dạng JSON).
- [ ] `trust proxy` được cấu hình đúng số lớp proxy.
- [ ] CORS giới hạn origin.
- [ ] Mật khẩu database không dùng giá trị mẫu trong `docker-compose.yml`.
- [ ] Swagger `/docs` được tắt hoặc bảo vệ ở production (hiện luôn bật).
- [ ] Kết nối DB dùng TLS nếu DB không nằm cùng mạng nội bộ.

---

## 8. Báo Cáo Lỗ Hổng

Phát hiện lỗ hổng: báo trực tiếp cho người phụ trách kỹ thuật của dự án, **không** tạo issue công khai. Kèm `x-request-id` và các bước tái hiện nếu có.
