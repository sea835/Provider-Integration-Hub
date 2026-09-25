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

Endpoint không cần token được đánh dấu **Public**, endpoint cần role cụ thể ghi rõ role trong bảng ở mục 7.

| Tình huống | Kết quả |
|---|---|
| Thiếu header hoặc không phải dạng `Bearer <token>` | `401` — `Yêu cầu cung cấp Access Token để truy cập` |
| Token sai chữ ký, hết hạn, hoặc là refresh token | `401` — `Mã xác thực không hợp lệ hoặc đã hết hạn` |
| Endpoint yêu cầu role mà token không có | `403` — `Bạn không có quyền thực hiện hành động này` |

Access token sống **900 giây** (mặc định), refresh token **7 ngày**. Khi access token hết hạn, gọi `POST /auth/refresh` để lấy cặp token mới. Chi tiết: [SECURITY.md](./SECURITY.md).

### Role

| Role | Cách có được | Quyền hiện tại |
|---|---|---|
| `USER` | Tự đăng ký qua `POST /auth/register` (luôn là `USER`), hoặc ADMIN tạo | `/auth/me`, `/auth/logout` |
| `MANAGER` | ADMIN gán qua `POST/PATCH /users` | Như `USER` (chưa có endpoint riêng) |
| `ADMIN` | Script `npm run db:seed:admin`, hoặc ADMIN khác gán | Như trên + toàn bộ `/users` |

Role nằm trong access token. Khi role của một người dùng bị đổi, token cũ vẫn mang role cũ cho tới khi hết hạn; role mới có hiệu lực từ lần đăng nhập hoặc refresh tiếp theo.

---

## 3. Header

| Header | Chiều | Mô tả |
|---|---|---|
| `Authorization` | Request | `Bearer <accessToken>` |
| `x-request-id` | Request (tuỳ chọn) | Mã theo dõi từ upstream, tối đa 128 ký tự; dài hơn sẽ bị thay bằng mã mới |
| `x-request-id` | Response | Luôn có. Dùng để tra log khi báo lỗi |
| `X-RateLimit-Limit` | Response | Số request tối đa trong cửa sổ (không có ở `/health/*`) |
| `X-RateLimit-Remaining` | Response | Số request còn lại |
| `X-RateLimit-Reset` | Response | Số giây tới khi cửa sổ reset |
| `Retry-After` | Response (khi 429) | Số giây phải chờ |

---

## 4. Rate Limit

Đếm theo IP của client, trong cửa sổ 60 giây.

| Endpoint | Giới hạn |
|---|---|
| `POST /auth/register`, `POST /auth/login` | 10 request / 60 giây |
| `GET /health/live`, `GET /health/ready` | Không giới hạn |
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
| `403` | Tài khoản không ở trạng thái `ACTIVE`; token không có role mà endpoint yêu cầu |
| `404` | Không tìm thấy bản ghi |
| `409` | Trùng giá trị duy nhất (email) |
| `429` | Vượt rate limit |
| `500` | Lỗi hệ thống. Ở production `message` luôn là `Internal server error occurred` |
| `503` | `GET /health/ready`: database không phản hồi |

> Body gửi lên có field không khai báo (ví dụ gửi `role` vào `POST /auth/register`) sẽ bị **từ chối 400** với message `property role should not exist`, không bị bỏ qua âm thầm.

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
| `POST` | `/users` | Bearer · `ADMIN` | Tạo người dùng |
| `GET` | `/users` | Bearer · `ADMIN` | Danh sách người dùng |
| `GET` | `/users/:id` | Bearer · `ADMIN` | Chi tiết người dùng |
| `PATCH` | `/users/:id` | Bearer · `ADMIN` | Cập nhật người dùng (kể cả role) |
| `DELETE` | `/users/:id` | Bearer · `ADMIN` | Xoá người dùng |
| `GET` | `/health/live` | Public | Liveness: tiến trình còn sống |
| `GET` | `/health/ready` | Public | Readiness: sẵn sàng nhận traffic (kiểm tra DB) |

Người dùng không phải ADMIN xem thông tin của chính mình qua `GET /auth/me`.

---

## 8. Auth

### 8.1. `POST /auth/register` — Đăng ký

**Public** · Rate limit 10/phút · Tạo user mới với role `USER`, tạo phiên đăng nhập và trả luôn cặp token.

**Body**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `email` | string | ✅ | Đúng định dạng email |
| `password` | string | ✅ | Tối thiểu 6 ký tự |

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

Không nhận field `role`: gửi kèm `role` sẽ bị `400` `property role should not exist`. Quyền cao hơn do ADMIN cấp qua `PATCH /users/:id`.

**Response `201`** — `AuthResponse` (mục 11.2)

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

**Response `200`** — `UserResponse` (mục 11.1)

**Lỗi:** `401` thiếu/sai token · `404` `Người dùng không tồn tại` (user đã bị xoá sau khi cấp token)

---

## 9. Users

Mọi endpoint trong nhóm này yêu cầu **access token của role `ADMIN`**. Không có token → `401`; token của role khác → `403` `Bạn không có quyền thực hiện hành động này`.

### 9.1. `POST /users` — Tạo người dùng

**Body**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `email` | string | ✅ | Đúng định dạng email |
| `password` | string | ✅ | Tối thiểu 6 ký tự |
| `role` | string | | `ADMIN` \| `USER` \| `MANAGER`, mặc định `USER` |

User tạo qua endpoint này có `status: "ACTIVE"`. Không trả token (khác với `/auth/register`).

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
| `role` | string | `ADMIN` \| `USER` \| `MANAGER` |

**Response `200`** — `UserResponse` sau cập nhật

**Lỗi:** `400` · `404` · `409` email mới trùng với user khác

> Đổi mật khẩu hoặc role qua endpoint này **không** thu hồi các phiên đăng nhập đang có. Role mới có hiệu lực khi người dùng đăng nhập lại hoặc refresh token.

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

## 10. Health

Dùng cho probe của Docker / Kubernetes / load balancer. **Public**, không tính rate limit, không cần token.

### 10.1. `GET /health/live` — Liveness

Tiến trình còn sống và xử lý được request. **Không** kiểm tra database, nên DB gián đoạn không làm endpoint này lỗi.

**Response `200`**

```json
{
  "status": "ok",
  "uptimeSeconds": 3600,
  "timestamp": "2026-09-24T08:00:00.000Z"
}
```

### 10.2. `GET /health/ready` — Readiness

Sẵn sàng nhận traffic: chạy `select 1` trên database, chờ tối đa 3 giây.

**Response `200`**

```json
{
  "status": "ok",
  "checks": {
    "database": { "status": "up", "latencyMs": 3 }
  },
  "timestamp": "2026-09-24T08:00:00.000Z"
}
```

**Response `503`** — database lỗi hoặc không phản hồi trong 3 giây. Theo định dạng lỗi chung (mục 5), trạng thái từng phụ thuộc nằm trong `details`:

```json
{
  "statusCode": 503,
  "error": "Service Unavailable",
  "message": "Hệ thống chưa sẵn sàng: database không phản hồi",
  "details": {
    "database": { "status": "down", "latencyMs": 3001 }
  },
  "timestamp": "2026-09-24T08:00:00.000Z",
  "path": "/health/ready",
  "requestId": "0192f3a1-..."
}
```

Lý do lỗi cụ thể (sai mật khẩu, từ chối kết nối...) **không** có trong response — tra log theo `requestId`.

---

## 11. Kiểu Dữ Liệu

### 11.1. `UserResponse`

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

### 11.2. `AuthResponse`

| Field | Kiểu | Mô tả |
|---|---|---|
| `accessToken` | string | JWT, gắn vào header `Authorization: Bearer ...` |
| `refreshToken` | string | JWT, chỉ dùng cho `POST /auth/refresh` |
| `expiresIn` | number | Thời gian sống của **access token**, tính bằng giây |
| `user` | `UserResponse` | |

### 11.3. Payload của JWT

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

## 12. Ví Dụ Luồng Sử Dụng

### Người dùng thường

```bash
BASE=http://localhost:3000

# 0. Hệ thống sẵn sàng?
curl -s $BASE/health/ready

# 1. Đăng ký (luôn nhận role USER)
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

### Quản trị viên

```bash
# 1. Tạo ADMIN đầu tiên (chạy một lần, trên máy có quyền vào DB)
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='ChangeMe123!' npm run db:seed:admin

# 2. Đăng nhập bằng ADMIN
ADMIN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}' | jq -r .accessToken)

# 3. Xem danh sách, nâng quyền một người dùng lên MANAGER
curl -s "$BASE/users?page=1&limit=20" -H "Authorization: Bearer $ADMIN"
curl -s -X PATCH $BASE/users/<id> \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"role":"MANAGER"}'
```

---

## 13. Postman

Import `postman/Provider_Integration_Hub.postman_collection.json` và environment `postman/Provider_Integration_Hub.postman_environment.json`.

| Nhóm | Request |
|---|---|
| Health | Liveness, Readiness |
| Auth | Register, Login (Admin), Me, Refresh Token |
| Users | Create, Get All, Get By ID, Update (đổi role), Delete, Verify Deleted |
| (cuối) | Logout |

- Điền `adminEmail`, `adminPassword` trong environment bằng tài khoản tạo từ `npm run db:seed:admin`.
- Collection dùng auth Bearer `{{accessToken}}`; `Login (Admin)` và `Refresh Token` tự lưu token vào biến collection.
- Chạy cả collection theo thứ tự (Collection Runner) để đi hết luồng; `Logout` đặt cuối cùng.
