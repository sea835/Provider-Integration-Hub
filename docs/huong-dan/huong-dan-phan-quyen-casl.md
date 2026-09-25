# Hướng Dẫn Phân Quyền CASL (Authorization Guide)

Tài liệu hướng dẫn cách sử dụng, cấu hình và mở rộng hệ thống phân quyền **CASL (`@casl/ability`)** theo chuẩn **DDD + Hexagonal** trong dự án **Provider Integration Hub**.

Module tham chiếu trong source: [`src/modules/authorization`](../../src/modules/authorization).  
Module xác thực danh tính liên quan: [`src/modules/authentication`](../../src/modules/authentication).

---

## 1. Ý Tưởng Cốt Lõi Trong 30 Giây

Hệ thống phân quyền tách bạch hoàn toàn 2 khái niệm:
- **Authentication (`src/modules/authentication`)**: Xác thực danh tính — *"Bạn là ai?"*. `JwtAuthGuard` giải mã Bearer Token và gán `TokenPayload` vào `request.user`.
- **Authorization (`src/modules/authorization`)**: Cấp quyền truy cập — *"Bạn được phép làm gì?"*. `PoliciesGuard` dùng `CaslAbilityFactory` để tạo bộ quyền `AppAbility` và kiểm tra qua decorator `@CheckPolicies(...)`.

```
                  ┌───────────────────────────────┐
  HTTP Request ─► │ 1. JwtAuthGuard (Module Auth) │ ──► Giải mã Token -> gán req.user
                  └──────────────┬────────────────┘
                                 ▼
                  ┌───────────────────────────────┐
                  │ 2. PoliciesGuard (Module AuthZ)│ ◄── Đọc @CheckPolicies metadata
                  └──────────────┬────────────────┘         │
                                 │                          ▼
                                 │                   CaslAbilityFactory
                                 │                   (tạo AppAbility cho user)
                                 ▼
                  ┌───────────────────────────────┐
                  │ 3. Target Controller Endpoint │ ──► Thực thi nghiệp vụ nếu hợp lệ
                  └───────────────────────────────┘     (ném 403 Forbidden nếu không đủ quyền)
```

**Quy tắc vàng:**
1. **Một nguồn chân lý duy nhất (Single Source of Truth):** Toàn bộ luật phân quyền nằm tại `CaslAbilityFactory`. Không viết logic rải rác `if (user.role === ...)` bên trong Controller.
2. **CASL bao hàm Role:** Không dùng `@Roles(...)` riêng biệt. Role chỉ là một thuộc tính đầu vào để sinh quyền trong CASL.
3. **Mặc định từ chối (Deny by default):** Nếu route gắn `@CheckPolicies(...)` mà user không thỏa mãn bất kỳ policy nào hoặc chưa đăng nhập, hệ thống lập tức chặn bằng mã `403 Forbidden`.

---

## 2. Cấu Trúc Thư Mục & Vai Trò Từng File

```
src/modules/authorization/
├── domain/
│   ├── action.enum.ts                    ★ Enum hành động cốt lõi: Manage, Read, Create...
│   └── policy.types.ts                   ★ Khai báo Subjects, AppAbility, PolicyHandler interface
├── application/
│   ├── casl-ability.factory.ts           ★ Trái tim phân quyền: sinh bộ quyền từ User/Role
│   └── casl-ability.factory.spec.ts      ★ Unit test kiểm thử bộ quyền
├── presentation/
│   ├── decorators/
│   │   └── check-policies.decorator.ts   ★ Decorator @CheckPolicies(...)
│   └── guards/
│       ├── policies.guard.ts             ★ Global Guard chạy tự động sau JwtAuthGuard
│       └── policies.guard.spec.ts        ★ Unit test kiểm thử Guard
└── authorization.module.ts               ★ Cấu hình DI và export Provider
```

### Bảng tóm tắt vai trò từng file

| File | Layer | Trách nhiệm | Khi nào cần sửa |
|---|---|---|---|
| `action.enum.ts` | Domain | Định nghĩa các hành động (`Manage`, `Create`, `Read`, `Update`, `Delete`) | Khi hệ thống có hành động nghiệp vụ đặc thù mới (vd: `Approve`, `Export`) |
| `policy.types.ts` | Domain | Khai báo danh sách `Subjects` (Entity được phân quyền) và type `AppAbility` | **Khi tạo Module/Entity mới** cần đưa vào diện phân quyền CASL |
| `casl-ability.factory.ts` | Application | Nạp luật phân quyền dựa trên `user.role` hoặc thuộc tính người dùng | **Khi cần thêm/bớt quyền** cho Role hoặc định nghĩa điều kiện ABAC mới |
| `check-policies.decorator.ts` | Presentation | Decorator `@CheckPolicies(...)` gắn metadata lên handler hoặc controller | Hiếm khi sửa (dùng trực tiếp trong controller) |
| `policies.guard.ts` | Presentation | Lấy `req.user`, gọi factory sinh ability và thực thi các policy handlers | Hiếm khi sửa (đã đăng ký toàn cục trong `AppModule`) |

---

## 3. Hướng Dẫn Dành Cho Lập Trình Viên (How-To)

### 3.1. Cách bảo vệ một Endpoint / Controller

Muốn bảo vệ route, bạn gắn decorator `@CheckPolicies(...)` lên class Controller hoặc từng method cụ thể:

#### Ví dụ 1: Bảo vệ toàn bộ Controller (Chỉ Admin hoặc người có toàn quyền)
```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '@modules/authorization/presentation/decorators/check-policies.decorator';
import { Action } from '@modules/authorization/domain/action.enum';
import { UserEntity } from '@modules/user/domain/user.entity';

@CheckPolicies((ability) => ability.can(Action.Manage, UserEntity))
@ApiBearerAuth()
@Controller('users')
export class UserController {
  // Mọi method trong Controller này đều yêu cầu quyền Manage trên UserEntity
}
```

#### Ví dụ 2: Phân quyền chi tiết theo từng hành động trên từng method
```typescript
@Controller('providers')
export class ProviderController {
  // Ai có quyền Read đều xem được danh sách
  @Get()
  @CheckPolicies((ability) => ability.can(Action.Read, ProviderEntity))
  async findAll() { ... }

  // Chỉ ai có quyền Create mới được tạo mới
  @Post()
  @CheckPolicies((ability) => ability.can(Action.Create, ProviderEntity))
  async create() { ... }

  // Chỉ ai có quyền Delete mới được xóa
  @Delete(':id')
  @CheckPolicies((ability) => ability.can(Action.Delete, ProviderEntity))
  async remove() { ... }
}
```

---

### 3.2. Cách thêm Entity mới vào hệ thống Phân Quyền

Khi bạn tạo một module mới (ví dụ module `provider` với entity `ProviderEntity`), hãy làm theo 2 bước sau:

#### Bước 1: Khai báo Entity vào `Subjects`
Mở file `src/modules/authorization/domain/policy.types.ts`:
```typescript
import { InferSubjects, MongoAbility } from '@casl/ability';
import { UserEntity } from '@modules/user/domain/user.entity';
import { ProviderEntity } from '@modules/provider/domain/provider.entity'; // <-- Thêm entity mới
import { Action } from './action.enum';

export type Subjects =
  | InferSubjects<typeof UserEntity>
  | InferSubjects<typeof ProviderEntity> // <-- Thêm vào union type
  | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;
```

#### Bước 2: Định nghĩa quyền hạn trong `CaslAbilityFactory`
Mở file `src/modules/authorization/application/casl-ability.factory.ts`:
```typescript
if (user?.role === Role.ADMIN) {
  can(Action.Manage, 'all'); // Admin tự động có quyền trên ProviderEntity
} else if (user?.role === Role.MANAGER) {
  can(Action.Read, ProviderEntity);
  can(Action.Update, ProviderEntity);
  cannot(Action.Delete, ProviderEntity);
} else if (user?.role === Role.USER) {
  can(Action.Read, ProviderEntity);
  cannot(Action.Create, ProviderEntity);
}
```

---

### 3.3. Phân quyền cấp bản ghi (Instance-Level / ABAC)

`PoliciesGuard` chạy trước khi Controller gọi Service, nên Guard chỉ kiểm tra quyền ở cấp **Type/Class** (chưa load bản ghi từ Database). 

Khi bạn cần kiểm tra điều kiện dữ liệu thực tế (ví dụ: *"Người dùng chỉ được sửa thông tin của chính mình, không được sửa của người khác"*):

#### Cách thực hiện trong Controller / Service:
```typescript
@Patch(':id')
@CheckPolicies((ability) => ability.can(Action.Update, UserEntity))
async update(
  @Param('id') id: string,
  @Body() dto: UpdateUserDto,
  @CurrentUser() currentUser: TokenPayload,
) {
  // 1. Lấy bản ghi thực tế từ database
  const targetUser = await this.userService.findOne(id);

  // 2. Tạo ability của user hiện tại
  const ability = this.caslAbilityFactory.createForUser(currentUser);

  // 3. Kiểm tra quyền trên INSTANCE thực tế
  if (!ability.can(Action.Update, targetUser)) {
    throw new ForbiddenException('Bạn chỉ có quyền cập nhật thông tin của chính mình');
  }

  return this.userService.update(id, dto);
}
```

> 💡 Trong `CaslAbilityFactory`, rule `{ id: user.sub }` đã được cấu hình sẵn:
> `can(Action.Update, UserEntity, { id: user.sub } as never);`  
> Khi truyền `targetUser` vào `ability.can(Action.Update, targetUser)`, CASL sẽ tự so sánh `targetUser.id === currentUser.sub`!

---

### 3.4. Viết Custom Policy Handler dạng Class

Nếu logic kiểm tra quyền quá dài hoặc cần inject dependency, bạn có thể tạo một class handler kế thừa `IPolicyHandler`:

```typescript
import { IPolicyHandler, AppAbility } from '@modules/authorization/domain/policy.types';
import { Action } from '@modules/authorization/domain/action.enum';
import { UserEntity } from '@modules/user/domain/user.entity';

export class ReadUserPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return ability.can(Action.Read, UserEntity);
  }
}
```
Sau đó sử dụng:
```typescript
@Get()
@CheckPolicies(new ReadUserPolicyHandler())
async findAll() { ... }
```

---

## 4. Hướng Dẫn Viết Unit Test Cho Quyền Hạn

Mỗi khi thêm quyền hoặc sửa rule, **bắt buộc phải bổ sung Unit Test** vào [`casl-ability.factory.spec.ts`](../../src/modules/authorization/application/casl-ability.factory.spec.ts).

### Mẫu test rule mới:
```typescript
it('nên cho phép MANAGER đọc và cập nhật nhưng không được xóa ProviderEntity', () => {
  const managerUser: TokenPayload = {
    sub: 'manager-uuid',
    email: 'manager@example.com',
    role: Role.MANAGER,
  };
  const ability = factory.createForUser(managerUser);

  expect(ability.can(Action.Read, ProviderEntity)).toBe(true);
  expect(ability.can(Action.Update, ProviderEntity)).toBe(true);
  expect(ability.can(Action.Delete, ProviderEntity)).toBe(false);
});
```

Chạy test kiểm tra:
```bash
npm test src/modules/authorization
```

---

## 5. Quy Tắc Bắt Buộc (Do & Don't)

| ✅ NÊN LÀM | ❌ TUYỆT ĐỐI TRÁNH |
|---|---|
| Dùng `@CheckPolicies(...)` cho mọi endpoint cần bảo vệ quyền | Dùng decorator `@Roles(...)` (cơ chế cũ đã bị khai tử) |
| Định nghĩa toàn bộ quyền hạn tập trung tại `CaslAbilityFactory` | Viết rải rác `if (user.role === 'ADMIN')` trong Controller |
| Luôn cập nhật `policy.types.ts` khi có Entity mới | Bỏ qua việc khai báo Entity trong union `Subjects` |
| Sử dụng `subject.id === user.sub` cho các logic sở hữu bản ghi (ABAC) | Query toàn bộ quyền trực tiếp từ Database trong Guard ở mỗi request |
| Viết Unit test cho mọi rule mới được thêm vào Factory | Deploy code phân quyền mà không chạy `npm test` |

---

## 6. Lộ Trình Mở Rộng: Phân Quyền Động & Cấp Bộ API (Giai Đoạn 2)

Hệ thống hiện tại đang chạy ở **Giai đoạn 1** (Rule tĩnh trong code qua Factory). Khi dự án có nhu cầu cho phép Quản trị viên tự định nghĩa Role và gán quyền trực tiếp qua giao diện Web:

### 6.1. Thiết kế bảng Database Drizzle
Tạo bảng tại `src/modules/authorization/infrastructure/authorization.schema.ts`:
- `roles`: `id`, `code`, `name`, `description`.
- `permissions`: `id`, `action`, `subject`, `conditions` (dạng JSONB).
- `role_permissions`: quan hệ nhiều-nhiều giữa `roles` và `permissions`.

### 6.2. Bộ REST API Quản trị
- `GET/POST /api/authorization/roles`: Quản lý danh mục vai trò.
- `GET /api/authorization/permissions`: Danh mục quyền hệ thống.
- `POST /api/authorization/roles/:id/permissions`: Gán danh sách quyền cho vai trò.
- `GET /api/authorization/me/abilities`: Trả về danh sách rules dạng JSON (sử dụng `packRules` từ `@casl/ability/extra`) để Frontend (React/Vue) ẩn/hiện nút bấm tương ứng.

### 6.3. Tối ưu hiệu năng bằng Redis
- Lưu permissions của user vào Redis: `auth:abilities:${userId}` (TTL 15 phút).
- Khi Admin thay đổi phân quyền của role/user qua API: Xóa cache tương ứng để cập nhật quyền tức thì.

---

## 7. Xử Lý Sự Cố & Câu Hỏi Thường Gặp (FAQ)

### Q1: Tại sao route trả về 403 Forbidden dù tôi đã đăng nhập?
- **Nguyên nhân 1:** Token của bạn thuộc role chưa được cấp quyền thực hiện `Action` đó trên `Subject` đó trong `CaslAbilityFactory`.
- **Nguyên nhân 2:** Route yêu cầu quyền trên Instance nhưng dữ liệu không thỏa mãn điều kiện (ví dụ: User A cố sửa bản ghi của User B).
- **Cách khắc phục:** Kiểm tra lại role của user trong JWT payload (`sub`, `role`) và đối chiếu với rule trong `casl-ability.factory.ts`.

### Q2: Các route Public không cần đăng nhập có bị chặn không?
- Không. Các route gắn `@Public()` (ví dụ `/auth/login`, `/health/live`) sẽ được `JwtAuthGuard` cho qua. Nếu route không gắn `@CheckPolicies(...)`, `PoliciesGuard` cũng sẽ tự động cho qua (`return true`).

### Q3: Làm sao để tạo tài khoản Admin thử nghiệm?
Sử dụng script có sẵn trong dự án:
```bash
ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="YourPassword123!" npm run db:seed:admin
```
