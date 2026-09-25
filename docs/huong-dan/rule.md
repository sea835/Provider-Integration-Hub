# 📐 Bộ Quy Tắc & Phong Cách Lập Trình (Coding Guidelines & Rules)
**Dự án:** Provider Integration Hub  
**Phiên bản tài liệu:** 1.0.0  
**Áp dụng cho:** Toàn bộ thành viên phát triển Backend (NestJS, TypeScript, Drizzle ORM)

---

## 🏛️ 1. Triết Lý & Kiến Trúc Cốt Lõi (Architecture)

Hệ thống tuân thủ nghiêm ngặt mô hình **Domain-Driven Design (DDD) Hexagonal Architecture (Ports & Adapters)** kết hợp **Clean Architecture**.

```
src/modules/<module-name>/
├── domain/            ── Tầng lõi nghiệp vụ thuần túy (POJO / Pure TypeScript)
├── application/       ── Tầng điều phối Use Cases (Services, Commands, DTO nội bộ)
├── infrastructure/    ── Tầng hạ tầng (Drizzle Schemas, Repositories, Adapters, Config)
└── presentation/      ── Tầng giao tiếp bên ngoài (Controllers, DTOs, Guards, Decorators)
```

### Nguyên Tắc Bất Di Bất Dịch Giữa Các Tầng:
1. **Domain là trung tâm và độc lập tuyệt đối:**
   - ❌ **CẤM:** Import NestJS (`@Injectable`, `@Controller`, exceptions), Express, Drizzle ORM, hay bất kỳ thư viện bên thứ 3 nào vào tầng `domain/`.
   - ✅ **NÊN:** Chỉ chứa Domain Entities, Value Objects, Domain Errors và **Abstract Ports** (Output Ports).
2. **Application chỉ phụ thuộc vào Domain Ports:**
   - ❌ **CẤM:** Application Service gọi trực tiếp Drizzle ORM hoặc thư viện ngoài (như JWT, Axios).
   - ✅ **NÊN:** Giao tiếp qua Abstract Class / Interface Port (`UserRepositoryPort`, `TokenPort`, `SessionRepositoryPort`).
3. **Infrastructure triển khai (Implements) các Ports:**
   - Đảm bảo việc thay đổi database (Postgres -> MySQL/Mongo) hoặc thay đổi thư viện token không ảnh hưởng đến logic của Domain và Application.
4. **Presentation xử lý HTTP/giao diện:**
   - Tiếp nhận request, validate qua DTO, chuyển thành Command gọi Application Service, ánh xạ kết quả ra Response DTO.

---

## 🔗 2. Quy Tắc Import & Path Aliases (Strict Path Rule)

### ❌ KHÔNG BAO GIỜ dùng relative path `..` hoặc `../..`:
```ts
// ❌ SAI PHẠM
import { UserService } from '../application/user.service';
import { UserResponseDto } from './dto/user.response';
import { LoggerPort } from '../../../common/logger';
```

### ✅ BẮT BUỘC dùng 100% Path Aliases:
Hệ thống đã cấu hình alias trong `../../tsconfig.json` và Jest:
```ts
// ✅ CHUẨN MỰC
import { UserService } from '@modules/user/application/user.service';
import { UserResponseDto } from '@modules/user/presentation/dto/user.response';
import { LoggerPort } from '@common/logger';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';
import { AppModule } from '@/app.module';
```

| Alias | Thư mục trỏ đến | Mục đích sử dụng |
| :--- | :--- | :--- |
| `@/*` | `src/*` | File gốc nguồn |
| `@common/*` | `src/common/*` | Bộ lọc, interceptors, base classes, utilities dùng chung |
| `@modules/*` | `src/modules/*` | Các modules tính năng nghiệp vụ |
| `@infrastructure/*` | `src/infrastructure/*`| Cấu hình DB, Logger, Queue, bên ngoài |

### ⚠️ Lưu ý `isolatedModules` & Decorated Signatures:
Khi sử dụng type trong tham số của method có Decorator (như `@Req() req: Request`, `@CurrentUser() user: TokenPayload`), **bắt buộc dùng `import type`** để tránh lỗi `TS1272`:
```ts
// ✅ CHUẨN
import type { Request } from 'express';
import type { TokenPayload } from '@modules/auth/domain/auth-token.vo';
```

---

## 🎯 3. Quy Chuẩn Lean Controller (No Decorator Bloat)

Controllers phải được viết ngắn gọn, súc tích (**Lean Controller**), loại bỏ tình trạng spam decorator làm loãng code.

### ❌ KHÔNG NÊN (Decorator Bloat):
```ts
// ❌ RẤT XẤU & RƯỜM RÀ: 7-10 decorators cho 1 endpoint đơn giản
@Delete(':id')
@ApiOperation({ summary: 'Xóa một người dùng theo ID' })
@ApiParam({ name: 'id', description: 'UUIDv7 của người dùng' })
@ApiResponse({ status: HttpStatus.OK, description: 'Xóa thành công', type: Boolean })
@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Không tìm thấy người dùng' })
@ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Lỗi server' })
async remove(@Param('id') id: string): Promise<boolean> {
  return this.userService.remove(id);
}
```

### ✅ NÊN (Lean Controller):
Tận dụng tính năng TypeScript Reflection & Auto-inference của NestJS Swagger OpenAPI CLI:
```ts
// ✅ GỌN GÀNG, ĐỦ Ý, DỄ ĐỌC: Chỉ giữ đúng 1 @ApiOperation tóm tắt chức năng
@Delete(':id')
@ApiOperation({ summary: 'Xóa người dùng theo ID' })
async remove(@Param('id') id: string): Promise<boolean> {
  return this.userService.remove(id);
}
```

### Quy tắc Controller:
- Chỉ gắn `@ApiTags('<module>')` và `@ApiBearerAuth()` (nếu có auth) ở cấp Controller.
- Mỗi endpoint chỉ dùng tối đa **1 decorator `@ApiOperation({ summary: '...' })`**.
- Không lạm dụng `@ApiParam`, `@ApiResponse(200...)` vì kiểu trả về `Promise<T>` đã tự sinh schema trong Swagger.
- Luôn trả về HTTP status code phù hợp: `@HttpCode(HttpStatus.OK)` cho các endpoint POST đăng nhập, refresh, tìm kiếm phức tạp.

---

## 📦 4. Quy Chuẩn DTO & Data Serialization

1. **Phân tách rạch ròi Request DTO và Response DTO:**
   - `*.request.ts` (hoặc `create-*.dto.ts`, `update-*.dto.ts`): Dùng cho dữ liệu Client gửi lên.
   - `*.response.ts`: Dùng cho dữ liệu Server trả về cho Client.
2. **Validation nghiêm ngặt ở Request DTO:**
   - Dùng `class-validator` với thông điệp tiếng Việt thân thiện.
   - Luôn đi kèm `@ApiProperty` hoặc `@ApiPropertyOptional`.
   ```ts
   export class RegisterRequestDto {
     @ApiProperty({ example: 'user@example.com', description: 'Email đăng ký' })
     @IsEmail({}, { message: 'Email không đúng định dạng' })
     @IsNotEmpty({ message: 'Email không được để trống' })
     email: string;

     @ApiProperty({ example: 'SecurePass123!', description: 'Mật khẩu' })
     @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
     @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
     password: string;
   }
   ```
3. **Response DTO có Factory Method `fromEntity`:**
   - Tuyệt đối không để rò rỉ các trường nhạy cảm như `password`, `refreshTokenHash`.
   ```ts
   export class UserResponseDto {
     @ApiProperty() id: string;
     @ApiProperty() email: string;
     @ApiProperty() role: string;
     @ApiProperty() status: string;

     static fromEntity(user: UserEntity): UserResponseDto {
       const dto = new UserResponseDto();
       dto.id = user.id;
       dto.email = user.email;
       dto.role = user.role || 'USER';
       dto.status = user.status;
       return dto;
     }
   }
   ```

---

## 🛡️ 5. Tiêu Chuẩn Bảo Mật & Xác Thực (Security Best Practices)

1. **Băm Mật Khẩu & Token Non-blocking:**
   - Bắt buộc dùng `crypto.scrypt` (bất đồng bộ qua `promisify`) kết hợp `randomBytes(16)` làm salt.
   - Định dạng lưu trữ: `salt:derivedKey` (Hex).
   - Tuyệt đối không dùng `bcrypt.hashSync` hay các hàm blocking gây nghẽn Node.js Event Loop.
2. **Chống Tấn Công User Enumeration:**
   - Khi đăng nhập thất bại, dù sai email hay sai mật khẩu, **luôn trả về cùng một thông báo lỗi duy nhất**:
     `"Email hoặc mật khẩu không chính xác"` (`401 Unauthorized`).
   - Tuyệt đối không trả về: *"User not found"* hoặc *"Wrong password"*.
3. **Quản Lý Phiên Đa Thiết Bị (Multi-Device Session) & Refresh Token Rotation:**
   - ❌ **KHÔNG** lưu token trực tiếp trong bảng `users` (gây đè phiên khi đăng nhập từ nhiều máy).
   - ✅ **BẮT BUỘC** lưu phiên trong bảng riêng `sessions` (`userId`, `refreshTokenHash`, `ipAddress`, `userAgent`, `expiresAt`, `isRevoked`).
   - Mỗi lần gọi `POST /auth/refresh`, session cũ phải bị thu hồi (`revoke`) ngay lập tức và sinh cặp token mới (Token Rotation).
4. **Kiểm Tra Trạng Thái Tài Khoản:**
   - Chỉ cho phép đăng nhập và refresh khi `user.status === 'ACTIVE'`.
   - Nếu bị khóa (`BLOCKED` / `INACTIVE`), trả về `403 Forbidden`.
5. **Rate Limiting (Chống Brute-Force):**
   - Đặt giới hạn `@Throttle({ default: { limit: 10, ttl: 60000 } })` trên các route nhạy cảm (`/auth/login`, `/auth/register`).
6. **Null-Safety Trong Guards:**
   - `RolesGuard` phải kiểm tra an toàn:
     ```ts
     if (!user || !user.role) {
       throw new ForbiddenException('Bạn không có quyền thực hiện hành động này');
     }
     ```
   - Không được để xảy ra Unhandled Null Exception (lỗi 500) khi request thiếu thông tin user.

---

## 🗄️ 6. Quy Chuẩn Cơ Sở Dữ Liệu & Drizzle ORM

1. **Khóa Chính UUIDv7:**
   - Mọi bảng đều kế thừa từ `baseSchema` sử dụng `uuidv7` (có thứ tự thời gian tự nhiên, tối ưu đánh index B-Tree hơn UUIDv4 ngẫu nhiên).
2. **Ràng Buộc & Khóa Ngoại:**
   - Luôn định nghĩa rõ ràng `onDelete: 'cascade'` hoặc `'set null'` cho foreign keys (ví dụ: `sessions.userId` references `users.id` với `cascade`).
3. **Quy Trình Schema & Migration:**
   - Sửa schema trong `src/modules/<module>/infrastructure/<name>.schema.ts`.
   - Xuất migration qua: `npm run db:generate`.
   - Thực thi migration qua: `npm run db:migrate`.
   - Không chỉnh sửa file migration đã migrate lên production.

---

## 📝 7. Quy Chuẩn Logging & Tracing

1. **Tiêm Logger Chuẩn Qua Port:**
   - Constructor nhận `logger: LoggerPort`.
   - Khởi tạo child logger kèm layer và context:
     ```ts
     this.logger = logger.child(LogLayer.APPLICATION, 'Auth', AuthService.name);
     ```
2. **Phân Định Layer Rõ Ràng (`LogLayer`):**
   - `LogLayer.HTTP`: Tầng Request/Response Controller & Middleware.
   - `LogLayer.APPLICATION`: Tầng Service Use Cases.
   - `LogLayer.INFRASTRUCTURE`: Tầng Repositories, Database, External APIs.
   - `LogLayer.SYSTEM`: Tầng Filters, Pipes, Guards, Bootstrap.
3. **Request Tracing:**
   - Mỗi request phải có `x-request-id` (sinh tự động bằng UUIDv7 qua `RequestIdMiddleware` và lưu trong `AsyncLocalStorage`).
   - Mọi log ghi ra đều tự động mang theo `requestId` để trace lỗi end-to-end.

---

## ⚠️ 8. Chuẩn Hóa Lỗi (Error Handling)

1. Mọi lỗi Exception đều được định tuyến qua `GlobalExceptionFilter`.
2. Format phản hồi chuẩn của API khi gặp lỗi:
   ```json
   {
     "statusCode": 400,
     "error": "Bad Request",
     "message": ["Email không đúng định dạng"],
     "requestId": "0192f3a1-8e9a-7c3d-b4ef-123456789abc",
     "timestamp": "2026-09-24T09:00:00.000Z",
     "path": "/auth/register"
   }
   ```
3. Phân biệt rõ HTTP Exception (`NotFoundException`, `UnauthorizedException`, `ConflictException`) với Internal System Error (HTTP 500).

---

## 🧪 9. Quy Chuẩn Kiểm Thử (Unit & E2E Testing)

1. **Unit Tests (`*.spec.ts`):**
   - Đặt cùng thư mục với file cần test (e.g. `auth.service.spec.ts` nằm trong `application/`).
   - Mock tất cả các Ports/Repositories sử dụng `Record<string, jest.Mock>` để tránh lỗi `@typescript-eslint/unbound-method`.
   - Kiểm tra cả kịch bản thành công (Happy path) và tất cả kịch bản lỗi (Edge cases, security exceptions).
2. **E2E Tests (`test/*.e2e-spec.ts`):**
   - Đặt trong thư mục `/test/`.
   - Kiểm thử trọn vẹn luồng HTTP: Request -> Filter -> Guard -> Controller -> Service -> DB -> Response.
   - Kiểm tra tính đúng đắn của HTTP status code, format payload, và bảo mật (không lộ password, token rotation).

---

## ✅ 10. Checklist Kiểm Tra Trước Khi Hoàn Thành Code (Definition of Done)

Mọi pull request hoặc task code mới chỉ được coi là hoàn tất khi vượt qua 100% các bước sau:

- [ ] **1. Kiến trúc:** Đảm bảo không vi phạm luồng phụ thuộc giữa các tầng Hexagonal.
- [ ] **2. Path Aliases:** 100% import sử dụng `@/*`, `@common/*`, `@modules/*`, `@infrastructure/*` (không còn `..` hay `../..`).
- [ ] **3. Lean Controller:** Tối đa 1 `@ApiOperation` cho mỗi endpoint, không decorator thừa.
- [ ] **4. Bảo mật:** Không lộ trường nhạy cảm, có rate limit, chống user enumeration.
- [ ] **5. ESLint:** Chạy lệnh `npm run lint` đạt **0 errors, 0 warnings**.
- [ ] **6. Unit Tests:** Chạy `npm test` đạt **100% Pass**.
- [ ] **7. E2E Tests:** Chạy `npm run test:e2e` đạt **100% Pass**.
- [ ] **8. Production Build:** Chạy `npm run build` thành công, không phát sinh lỗi biên dịch TypeScript.
