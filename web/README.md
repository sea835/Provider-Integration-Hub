# Provider Integration Hub — Web

Giao diện quản trị cho Provider Integration Hub: đăng nhập, bảng điều khiển, quản lý nhà cung cấp, người dùng và phân quyền động (CASL).

## Chạy nhanh

```bash
cd web
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3001 (backend NestJS mặc định ở cổng 3000)
```

| Lệnh                          | Mục đích                                |
| ----------------------------- | --------------------------------------- |
| `npm run dev`                 | Dev server (Turbopack) cổng 3001        |
| `npm run build` / `npm start` | Build và chạy bản production            |
| `npm run typecheck`           | Kiểm tra TypeScript                     |
| `npm run lint`                | ESLint (bao gồm quy tắc React Compiler) |
| `npm run format`              | Prettier + sắp xếp class Tailwind       |

## Biến môi trường

| Biến                               | Mặc định                | Ý nghĩa                                                                                                 |
| ---------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `BACKEND_API_URL`                  | `http://localhost:3000` | Địa chỉ NestJS API. Chỉ dùng phía server (BFF), không lộ ra trình duyệt                                 |
| `NEXT_PUBLIC_PROVIDER_DATA_SOURCE` | `mock`                  | `mock`: dữ liệu nhà cung cấp mô phỏng trong trình duyệt. `api`: gọi `/providers` thật khi backend đã có |

## Công nghệ

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, Tailwind CSS 4, Radix UI, TanStack Query 5, React Hook Form + Zod 4, CASL (`@casl/ability`, `@casl/react`), Sonner, next-themes. Font Be Vietnam Pro (hỗ trợ đầy đủ tiếng Việt) và JetBrains Mono.

## Kiến trúc

```
src/
├── proxy.ts                     Chặn truy cập khi chưa đăng nhập, chuyển hướng /login ↔ trang đích
├── app/
│   ├── (auth)/login             Màn hình đăng nhập
│   ├── (app)/                   Khu vực cần đăng nhập: layout server nạp sẵn phiên + abilities
│   │   ├── page.tsx             Bảng điều khiển
│   │   ├── providers/[id]       Danh sách và chi tiết nhà cung cấp
│   │   ├── users                Quản lý người dùng
│   │   └── access               Vai trò, danh mục quyền, ma trận phân quyền
│   └── api/
│       ├── auth/login|logout    Đăng nhập / đăng xuất, ghi và xóa cookie httpOnly
│       └── backend/[...path]    BFF proxy tới NestJS, tự gắn Bearer và làm mới token
├── features/                    Mỗi nghiệp vụ: api, hooks (TanStack Query), components
├── components/ui                Primitive dùng chung (Radix + Tailwind)
└── lib/                         api client, lỗi, CASL, định dạng, cấu hình server
```

### Xác thực và làm mới token

- Access token và refresh token nằm trong cookie `httpOnly`, `SameSite=Lax` (`pih_at`, `pih_rt`); JavaScript phía trình duyệt không đọc được token.
- Mọi request từ trình duyệt đi qua `/api/backend/*`. BFF làm mới token trước khi access token hết hạn (còn dưới 20 giây) và thử lại một lần khi backend trả 401.
- Refresh token được xoay vòng (rotation) ở backend. Để nhiều request song song không tiêu thụ cùng một refresh token, BFF gộp các lần refresh trùng nhau trong 30 giây; client thử lại thêm một lần sau 300 ms rồi mới đăng xuất.
- Các request thay đổi dữ liệu bị từ chối nếu header `Origin` khác host. Các đường dẫn `auth/login|register|refresh` không đi qua proxy chung.
- Gộp refresh dùng bộ nhớ trong tiến trình. Khi chạy nhiều instance, nên dùng sticky session hoặc chuyển sổ đăng ký sang kho dùng chung (Redis).

### Phân quyền động

- Layout server gọi song song `/auth/me` và `/authorization/me/abilities`, client dựng `MongoAbility` và cung cấp qua `AbilityProvider`.
- `src/lib/auth/policies.ts` là bảng ánh xạ duy nhất giữa thao tác trên giao diện và quyền, khớp với guard ở backend:

| Khu vực                                 | Yêu cầu                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| Menu và trang Người dùng                | `manage · User` (khớp `@CheckPolicies` của `UserController`)       |
| Tạo / sửa / xóa người dùng              | `create` / `update` / `delete · User` (kiểm tra theo từng bản ghi) |
| Menu và trang Phân quyền                | `manage · all`                                                     |
| Nhà cung cấp: xem · kiểm tra kết nối    | `read · Provider`                                                  |
| Nhà cung cấp: thêm / sửa, đồng bộ / xóa | `create` / `update` / `delete · Provider`                          |

- Menu, nút và trang không đủ quyền được ẩn hoặc thay bằng màn hình “không có quyền”. Abilities được làm mới khi quay lại tab sau 5 phút và ngay sau khi lưu ma trận phân quyền.

## Hợp đồng API Nhà cung cấp (backend cần triển khai)

Backend hiện chưa có module Provider. Giao diện đã hoàn chỉnh trên một repository mô phỏng; khi backend có các endpoint dưới đây, đặt `NEXT_PUBLIC_PROVIDER_DATA_SOURCE=api`. Kiểu dữ liệu chi tiết ở `src/features/providers/types.ts`.

| Method   | Path                             | Trả về                                                                           |
| -------- | -------------------------------- | -------------------------------------------------------------------------------- |
| `GET`    | `/providers`                     | `Provider[]`                                                                     |
| `GET`    | `/providers/:id`                 | `Provider`                                                                       |
| `POST`   | `/providers`                     | `Provider` (body `ProviderInput`)                                                |
| `PATCH`  | `/providers/:id`                 | `Provider` (body `ProviderUpdateInput`)                                          |
| `DELETE` | `/providers/:id`                 | 2xx                                                                              |
| `POST`   | `/providers/:id/test-connection` | `ConnectionTestResult`                                                           |
| `POST`   | `/providers/:id/sync`            | `ProviderLog` với `status: "RUNNING"`; giao diện tự poll 2 giây/lần tới khi xong |
| `GET`    | `/providers/:id/logs?limit=`     | `ProviderLog[]`, mới nhất trước                                                  |
| `GET`    | `/providers/logs?limit=`         | `ProviderLog[]` của mọi nhà cung cấp, cho bảng điều khiển                        |

Thông tin bí mật (API key, client secret, mật khẩu) chỉ được gửi lên khi người dùng nhập giá trị mới; backend chỉ nên trả về bản tóm tắt (`apiKeyLast4`, `clientId`, `username`, `hasSecret`).

## Những điểm backend cần xử lý

| Vấn đề                                                                                                                       | Ảnh hưởng tới giao diện                                                                                                                            | Đề xuất                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /authorization/me/abilities` trả `subject: null` cho quyền trên `User` vì `packRules` không biết tên class `UserEntity` | `unpackRules` của CASL phía client bị lỗi với mọi tài khoản không phải ADMIN. Frontend đang tạm ánh xạ `null → "User"` trong `lib/auth/ability.ts` | Truyền hàm đóng gói: `packRules(ability.rules, (s) => (typeof s === "string" ? s : "User"))`, hoặc dùng subject dạng chuỗi trong `CaslAbilityFactory` |
| `UpdateUserDto` không có trường `status`                                                                                     | Nút khóa / kích hoạt tài khoản nhận 400; giao diện báo “Máy chủ chưa hỗ trợ cập nhật trường status”                                                | Thêm `status` (`ACTIVE` \| `LOCKED`) vào DTO; `login` và `refresh` đã chặn tài khoản khác `ACTIVE`                                                    |
| Cột thời gian là `timestamp without time zone`, DB chạy múi giờ `Asia/Ho_Chi_Minh`, Drizzle đọc giá trị như UTC              | Bản ghi mới hiển thị “sau 7 giờ nữa”                                                                                                               | Dùng `timestamp(..., { withTimezone: true })` hoặc đặt timezone kết nối về UTC                                                                        |
| `GET /users` chưa có tổng số, tìm kiếm và lọc phía server                                                                    | Giao diện tải toàn bộ danh sách theo trang 100 bản ghi (tối đa 5.000) rồi lọc ở client                                                             | Dùng `findPaginated` có sẵn và thêm tham số `q`, `role`, `status`                                                                                     |
| `UpdateUserDto.role` chỉ nhận `ADMIN`, `MANAGER`, `USER`                                                                     | Vai trò tạo thêm ở trang Phân quyền chưa gán được cho người dùng                                                                                   | Kiểm tra `role` theo bảng `roles` thay vì enum cố định                                                                                                |
| Rate limit tính theo IP, backend không bật `trust proxy`                                                                     | Qua BFF, mọi người dùng chung giới hạn của IP máy chủ Next                                                                                         | Bật `app.set("trust proxy", ...)`; BFF đã chuyển tiếp `X-Forwarded-For`                                                                               |
| Không có endpoint nhật ký hoạt động hệ thống                                                                                 | “Hoạt động gần đây” ghép từ nhật ký nhà cung cấp và tài khoản mới                                                                                  | Bổ sung audit log nếu cần lịch sử đầy đủ                                                                                                              |

## Xử lý sự cố

**`Cannot find module '../lightningcss.darwin-x64.node'`** trên máy Apple Silicon: dự án được cài bằng Node arm64 nhưng từng được chạy bằng một bản Node x64 (ví dụ Node cài qua nvm khi terminal đang ở chế độ Rosetta). Turbopack lưu cả kết quả lỗi vào cache `.next/dev/cache`, nên lỗi vẫn lặp lại kể cả khi đã đổi sang Node đúng. Cách xử lý:

```bash
nvm use                # đọc .nvmrc
node -p process.arch   # phải là arm64
rm -rf .next
npm run dev
```
