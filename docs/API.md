# Đặc Tả REST API

Đặc tả các endpoint hiện có của Provider Integration Hub, quy ước chung về xác thực, lỗi, phân trang và rate limit.

Swagger UI (sinh tự động từ code) khi chạy local: `http://localhost:3000/docs`. Khi tài liệu này và Swagger khác nhau, **code là nguồn đúng**.

---

## 1. Thông Tin Chung

| Mục | Giá trị |
|---|---|
| Base URL (local) | `http://localhost:3000` |
| Prefix / version | Không có (`/auth/login`, không phải `/api/v1/auth/login`) |
| Định dạng | JSON (`Content-Type: application/json`) |
| Thời gian | ISO 8601, ví dụ `2026-09-24T08:00:00.000Z` |
| ID | UUIDv7, ví dụ `0192f3a1-8e9a-7c3d-b4ef-123456789abc` |
| Ngôn ngữ thông báo lỗi | Tiếng Việt (validation, nghiệp vụ); một số lỗi hệ thống giữ tiếng Anh |

---

## 2. Xác Thực

Mọi endpoint **mặc định yêu cầu** access token:

```
Authorization: Bearer <accessToken>
```

Endpoint không cần token được đánh dấu **Public** trong bảng ở mục 7.

| Tình huống | Kết quả |
|---|---|
| Thiếu header hoặc không phải dạng `Bearer <token>` | `401` — `Yêu cầu cung cấp Access Token để truy cập` |
| Token sai chữ ký, hết hạn, hoặc là refresh token | `401` — `Mã xác thực không hợp lệ hoặc đã hết hạn` |
| Endpoint yêu cầu role mà token không có | `403` — `Bạn không có quyền thực hiện hành động này` |

Access token sống **900 giây** (mặc định), refresh token **7 ngày**. Khi access token hết hạn, gọi `POST /auth/refresh` để lấy cặp token mới. Chi tiết: [SECURITY.md](./SECURITY.md).

---

## 3. Header

| Header | Chiều | Mô tả |
|---|---|---|
| `Authorization` | Request | `Bearer <accessToken>` |
| `x-request-id` | Request (tuỳ chọn) | Mã theo dõi từ upstream, tối đa 128 ký tự; dài hơn sẽ bị thay bằng mã mới |
| `x-request-id` | Response | Luôn có. Dùng để tra log khi báo lỗi |
| `X-RateLimit-Limit` | Response | Số request tối đa trong cửa sổ |
| `X-RateLimit-Remaining` | Response | Số request còn lại |
| `X-RateLimit-Reset` | Response | Số giây tới khi cửa sổ reset |
| `Retry-After` | Response (khi 429) | Số giây phải chờ |

---

## 4. Rate Limit

Đếm theo IP của client, trong cửa sổ 60 giây.

| Endpoint | Giới hạn |
|---|---|
| `POST /auth/register`, `POST /auth/login` | 10 request / 60 giây |
| Mọi endpoint khác | 100 request / 60 giây |

Vượt giới hạn trả `429`:

```json
{
  "statusCode": 429,
  "error": "ThrottlerException",
  "message": "ThrottlerException: Too Many Requests",
  "timestamp": "2026-09-24T08:00:00.000Z",
  "path": "/auth/login",
  "requestId": "0192f3a1-..."
}
```

---

## 5. Định Dạng Lỗi

Mọi lỗi (validation, nghiệp vụ, database, hệ thống) đều trả về cùng một cấu trúc `ApiErrorResponse`:

| Field | Kiểu | Mô tả |
|---|---|---|
| `statusCode` | number | Mã HTTP |
| `error` | string | Tên lỗi: `Bad Request`, `Unauthorized`, `Conflict`... |
| `message` | string \| string[] | Thông báo. **Mảng** khi là lỗi validation (mỗi phần tử một lỗi) |
| `details` | any | Tuỳ chọn, thông tin bổ sung |
| `timestamp` | string | Thời điểm lỗi (ISO 8601) |
| `path` | string | Đường dẫn request |
| `requestId` | string | Trùng với header `x-request-id` |

Ví dụ lỗi validation:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["Email không đúng định dạng", "Mật khẩu phải có ít nhất 6 ký tự"],
  "timestamp": "2026-09-24T08:00:00.000Z",
  "path": "/auth/register",
  "requestId": "0192f3a1-8e9a-7c3d-b4ef-123456789abc"
}
```

### Bảng mã lỗi

| HTTP | Khi nào |
|---|---|
| `400` | Body/query sai kiểu, thiếu field, **có field lạ** không khai báo trong DTO, ID không phải UUID hợp lệ, tham chiếu khoá ngoại không tồn tại |
| `401` | Thiếu/sai access token; sai email hoặc mật khẩu; refresh token không hợp lệ hoặc phiên đã bị thu hồi |
| `403` | Tài khoản không ở trạng thái `ACTIVE`; không đủ role |
| `404` | Không tìm thấy bản ghi |
| `409` | Trùng giá trị duy nhất (email) |
| `429` | Vượt rate limit |
| `500` | Lỗi hệ thống. Ở production `message` luôn là `Internal server error occurred` |

> Body gửi lên có field không khai báo (ví dụ gửi `role` vào `POST /users`) sẽ bị **từ chối 400** với message `property role should not exist`, không bị bỏ qua âm thầm.

---

## 6. Phân Trang

Endpoint danh sách nhận query:

| Tham số | Kiểu | Mặc định | Ràng buộc |
|---|---|---|---|
| `page` | integer | 1 | ≥ 1 |
| `limit` | integer | 20 | 1–100 |

Kết quả sắp xếp theo `createdAt` giảm dần (mới nhất trước).

> Hiện `GET /users` trả về **mảng thuần**, chưa có tổng số bản ghi. Hạ tầng `PaginatedResult` (`{ data, meta: { total, page, limit, totalPages, hasNextPage, hasPrevPage } }`) đã có ở `BaseRepository.findPaginated` nhưng chưa được endpoint nào dùng.

---

## 7. Danh Sách Endpoint

| Method | Path | Xác thực | Mô tả |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Đăng ký tài khoản |
| `POST` | `/auth/login` | Public | Đăng nhập |
| `POST` | `/auth/refresh` | Public | Đổi refresh token lấy cặp token mới |
| `POST` | `/auth/logout` | Bearer | Thu hồi phiên hiện tại |
| `GET` | `/auth/me` | Bearer | Thông tin tài khoản đang đăng nhập |
| `POST` | `/users` | Public ⚠️ | Tạo người dùng |
| `GET` | `/users` | Public ⚠️ | Danh sách người dùng |
| `GET` | `/users/:id` | Public ⚠️ | Chi tiết người dùng |
| `PATCH` | `/users/:id` | Public ⚠️ | Cập nhật người dùng |
| `DELETE` | `/users/:id` | Public ⚠️ | Xoá người dùng |

> ⚠️ Toàn bộ `/users` đang gắn `@Public()` ở cấp controller. Đây là lỗ hổng đã biết ([SECURITY.md](./SECURITY.md) mục 6) — client **không nên** dựa vào việc các endpoint này public, vì sẽ bị khoá lại.

---

## 8. Auth

### 8.1. `POST /auth/register` — Đăng ký

**Public** · Rate limit 10/phút · Tạo user mới, tạo phiên đăng nhập và trả luôn cặp token.

**Body**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `email` | string | ✅ | Đúng định dạng email |
| `password` | string | ✅ | Tối thiểu 6 ký tự |
| `role` | string | | `ADMIN` \| `USER` \| `MANAGER`, mặc định `USER` |

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response `201`** — `AuthResponse` (mục 10.2)

**Lỗi:** `400` validation · `409` `Email đã tồn tại trong hệ thống` · `429`

---

### 8.2. `POST /auth/login` — Đăng nhập

**Public** · Rate limit 10/phút

**Body**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `email` | string | ✅ | Đúng định dạng email |
| `password` | string | ✅ | Tối thiểu 6 ký tự |

**Response `200`** — `AuthResponse`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "0192f3a1-8e9a-7c3d-b4ef-123456789abc",
    "email": "user@example.com",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "2026-09-24T08:00:00.000Z",
    "updatedAt": "2026-09-24T08:00:00.000Z",
    "createdBy": null,
    "updatedBy": null,
    "metadata": null
  }
}
```

**Lỗi**

| HTTP | Message | Khi nào |
|---|---|---|
| `400` | (mảng lỗi validation) | Body sai |
| `401` | `Email hoặc mật khẩu không chính xác` | Email không tồn tại **hoặc** sai mật khẩu (cố ý dùng chung một message) |
| `403` | `Tài khoản của bạn đã bị vô hiệu hóa hoặc tạm khóa` | Đúng mật khẩu nhưng `status` khác `ACTIVE` |
| `429` | | Vượt 10 lần/phút |

Mỗi lần đăng nhập thành công tạo **một phiên mới**; các phiên cũ vẫn còn hiệu lực (đăng nhập nhiều thiết bị).

---

### 8.3. `POST /auth/refresh` — Làm mới token

**Public** · Rate limit 100/phút

**Body**

| Field | Kiểu | Bắt buộc |
|---|---|---|
| `refreshToken` | string | ✅ |

**Response `200`** — `AuthResponse` với **cả access token và refresh token mới**.

Refresh token cũ bị thu hồi ngay (refresh token rotation): client **phải lưu refresh token mới** và bỏ token cũ. Dùng lại token cũ sẽ nhận `401`.

**Lỗi**

| HTTP | Message | Khi nào |
|---|---|---|
| `401` | `Refresh Token không hợp lệ hoặc đã hết hạn` | Sai chữ ký, hết hạn, hoặc gửi nhầm access token |
| `401` | `Phiên làm việc đã hết hạn hoặc đã bị thu hồi` | Đã logout, đã refresh trước đó, hoặc phiên hết hạn |
| `401` | `Refresh Token không hợp lệ` | Token không khớp với phiên |
| `403` | `Tài khoản không tồn tại hoặc đã bị vô hiệu hóa` | User bị xoá hoặc không còn `ACTIVE` |

---

### 8.4. `POST /auth/logout` — Đăng xuất

**Bearer** · Không có body.

Thu hồi **phiên gắn với access token đang dùng**. Các phiên trên thiết bị khác không bị ảnh hưởng.

**Response `200`**

```json
{ "success": true }
```

> Sau logout, refresh token của phiên đó không dùng được nữa, nhưng **access token vẫn hợp lệ tới khi hết hạn** (tối đa 15 phút). Client nên xoá cả hai token ở phía mình.

**Lỗi:** `401` thiếu/sai token.

---

### 8.5. `GET /auth/me` — Tài khoản hiện tại

**Bearer**

**Response `200`** — `UserResponse` (mục 10.1)

**Lỗi:** `401` thiếu/sai token · `404` `Người dùng không tồn tại` (user đã bị xoá sau khi cấp token)

---

## 9. Users

### 9.1. `POST /users` — Tạo người dùng

**Body**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `email` | string | ✅ | Đúng định dạng email |
| `password` | string | ✅ | Tối thiểu 6 ký tự |

User tạo qua endpoint này luôn có `role: "USER"`, `status: "ACTIVE"`. Không trả token (khác với `/auth/register`).

**Response `201`** — `UserResponse`

**Lỗi:** `400` validation · `409` `Giá trị 'x@y.com' của trường 'email' đã tồn tại trong hệ thống`

---

### 9.2. `GET /users` — Danh sách người dùng

**Query:** `page`, `limit` (mục 6)

```
GET /users?page=1&limit=20
```

**Response `200`** — `UserResponse[]`

**Lỗi:** `400` `page`/`limit` không hợp lệ

---

### 9.3. `GET /users/:id` — Chi tiết người dùng

**Response `200`** — `UserResponse`

**Lỗi:** `400` `Định dạng dữ liệu đầu vào không hợp lệ` (id không phải UUID) · `404` `Record with ID <id> not found`

---

### 9.4. `PATCH /users/:id` — Cập nhật người dùng

**Body** (mọi field tuỳ chọn)

| Field | Kiểu | Ràng buộc |
|---|---|---|
| `email` | string | Đúng định dạng email |
| `password` | string | Tối thiểu 6 ký tự; được băm trước khi lưu |

**Response `200`** — `UserResponse` sau cập nhật

**Lỗi:** `400` · `404` · `409` email mới trùng với user khác

> Đổi mật khẩu qua endpoint này **không** thu hồi các phiên đăng nhập đang có.

---

### 9.5. `DELETE /users/:id` — Xoá người dùng

Xoá cứng bản ghi. Mọi phiên (`sessions`) của user bị xoá theo (`ON DELETE CASCADE`).

**Response `200`** — body là chuỗi `true` với `Content-Type: text/html` (Nest gửi giá trị boolean dưới dạng text, **không phải JSON**):

```
true
```

> Client chỉ nên dựa vào status `200`. Đề xuất đổi endpoint sang `204 No Content` hoặc trả object `{ "success": true }` như `/auth/logout`.

**Lỗi:** `400` id sai định dạng · `404`

---

## 10. Kiểu Dữ Liệu

### 10.1. `UserResponse`

| Field | Kiểu | Mô tả |
|---|---|---|
| `id` | string (UUIDv7) | |
| `email` | string | |
| `role` | string | `ADMIN` \| `USER` \| `MANAGER` |
| `status` | string | `ACTIVE` hoặc trạng thái khác (hiện chưa có API đổi trạng thái) |
| `createdAt` | string (ISO 8601) | |
| `updatedAt` | string (ISO 8601) | |
| `createdBy` | string \| null | Chưa được ghi, luôn `null` |
| `updatedBy` | string \| null | Chưa được ghi, luôn `null` |
| `metadata` | object \| null | JSON mở rộng |

`password` **không bao giờ** có trong response.

### 10.2. `AuthResponse`

| Field | Kiểu | Mô tả |
|---|---|---|
| `accessToken` | string | JWT, gắn vào header `Authorization: Bearer ...` |
| `refreshToken` | string | JWT, chỉ dùng cho `POST /auth/refresh` |
| `expiresIn` | number | Thời gian sống của **access token**, tính bằng giây |
| `user` | `UserResponse` | |

### 10.3. Payload của JWT

Cả access token và refresh token cùng payload, ký bằng hai secret khác nhau (HS256):

```json
{
  "sub": "0192f3a1-8e9a-7c3d-b4ef-123456789abc",
  "email": "user@example.com",
  "role": "USER",
  "sessionId": "0192f3b2-...",
  "iat": 1790236800,
  "exp": 1790237700
}
```

---

## 11. Ví Dụ Luồng Sử Dụng

```bash
BASE=http://localhost:3000

# 1. Đăng ký
curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Secret123!"}'

# 2. Đăng nhập, lấy token
LOGIN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Secret123!"}')
ACCESS=$(echo "$LOGIN" | jq -r .accessToken)
REFRESH=$(echo "$LOGIN" | jq -r .refreshToken)

# 3. Gọi API cần xác thực
curl -s $BASE/auth/me -H "Authorization: Bearer $ACCESS"

# 4. Access token hết hạn → refresh (nhớ lưu refresh token MỚI)
curl -s -X POST $BASE/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}"

# 5. Đăng xuất
curl -s -X POST $BASE/auth/logout -H "Authorization: Bearer $ACCESS"
```

---

## 12. Postman

`postman/Provider_Integration_Hub.postman_collection.json` cùng environment (`baseUrl`, `userId`) hiện chỉ có nhóm **Users** (6 request). Nhóm **Auth** chưa được bổ sung.
