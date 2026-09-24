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
| Phân quyền | `RolesGuard` global, bật bằng `@Roles(...)` | `src/modules/auth/presentation/guards/roles.guard.ts` |
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
- **Role:** `ADMIN`, `USER`, `MANAGER` (hằng `Role` trong `user.schema.ts`). Role nằm trong JWT, nên đổi role của user chỉ có hiệu lực từ token kế tiếp.
- Giới hạn theo role:

```ts
import { Roles } from '@modules/auth/presentation/decorators/roles.decorator';
import { Role } from '@modules/user/infrastructure/user.schema';

@Roles(Role.ADMIN)
@Delete(':id')
remove(@Param('id') id: string) { ... }
```

- Lấy thông tin người gọi: `@CurrentUser() user: TokenPayload` hoặc `@CurrentUser('sub') userId: string`.

Hiện **chưa có endpoint nào dùng `@Roles`**.

---

## 6. Rủi Ro Đã Biết

### 🔴 R1 — Toàn bộ `/users` là public

`UserController` gắn `@Public()` ở cấp class. Người không đăng nhập có thể liệt kê mọi user, đổi email/mật khẩu của bất kỳ ai (chiếm tài khoản), và xoá user.

**Xử lý:** bỏ `@Public()`; gắn `@Roles(Role.ADMIN)` cho `GET /users`, `DELETE`, `POST`; với `PATCH` chỉ cho phép ADMIN hoặc chính chủ (`id === currentUser.sub`).

### 🔴 R2 — Tự đăng ký làm ADMIN

`RegisterRequestDto` nhận `role` từ client với giá trị cho phép gồm `ADMIN`. Bất kỳ ai cũng tạo được tài khoản quản trị.

**Xử lý:** bỏ field `role` khỏi DTO đăng ký, luôn gán `USER`. Tạo ADMIN bằng seed script hoặc endpoint dành riêng cho ADMIN.

### 🔴 R3 — JWT secret mặc định viết cứng

`loadAuthConfig()` dùng chuỗi mặc định khi thiếu `JWT_SECRET` / `REFRESH_JWT_SECRET`. Chuỗi này nằm trong source code, và `.env.example` không liệt kê hai biến này — triển khai theo `.env.example` sẽ chạy với secret công khai, cho phép ai cũng ký được token ADMIN.

**Xử lý:** bỏ giá trị mặc định, ném lỗi khi khởi động nếu thiếu secret (hoặc secret ngắn hơn 32 ký tự); bổ sung các biến vào `.env.example`.

### 🟠 R4 — Access token vẫn dùng được sau logout

`JwtAuthGuard` chỉ kiểm tra chữ ký và hạn, không kiểm tra session. Sau logout hoặc khi user bị khoá/xoá, access token còn hiệu lực tối đa `JWT_EXPIRES_IN_SEC` (15 phút).

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

### 🟡 R8 — Đổi mật khẩu không thu hồi phiên

`PATCH /users/:id` đổi mật khẩu nhưng các session cũ vẫn refresh được. Nên gọi `revokeAllUserSessions(userId)` khi đổi mật khẩu.

### 🟡 R9 — Chính sách mật khẩu yếu, không khoá tài khoản

Tối thiểu 6 ký tự; chống brute-force chỉ dựa vào rate limit 10 lần/phút/IP. Cân nhắc tăng độ dài tối thiểu và giới hạn số lần sai theo tài khoản.

### 🟡 R10 — Email phân biệt hoa thường

`User@x.com` và `user@x.com` là hai tài khoản. Chuẩn hoá email về chữ thường khi đăng ký/đăng nhập.

---

## 7. Checklist Trước Khi Lên Production

- [ ] R1, R2, R3 đã được xử lý.
- [ ] `JWT_SECRET` và `REFRESH_JWT_SECRET` là chuỗi ngẫu nhiên ≥ 32 ký tự, **khác nhau**, không commit vào repo.
- [ ] `NODE_ENV=production` (ẩn chi tiết lỗi 500, log dạng JSON).
- [ ] `trust proxy` được cấu hình đúng số lớp proxy.
- [ ] CORS giới hạn origin.
- [ ] Mật khẩu database không dùng giá trị mẫu trong `docker-compose.yml`.
- [ ] Swagger `/docs` được tắt hoặc bảo vệ ở production (hiện luôn bật).
- [ ] Kết nối DB dùng TLS nếu DB không nằm cùng mạng nội bộ.

---

## 8. Báo Cáo Lỗ Hổng

Phát hiện lỗ hổng: báo trực tiếp cho người phụ trách kỹ thuật của dự án, **không** tạo issue công khai. Kèm `x-request-id` và các bước tái hiện nếu có.
