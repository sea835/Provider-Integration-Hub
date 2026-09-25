# Hướng Dẫn Sử Dụng Phân Quyền CASL

Tài liệu thực hành cách phân quyền endpoint, thêm quyền cho Entity mới và quản trị vai trò/quyền hạn động.

---

## 1. Phân Quyền Cho Endpoint / Controller

Sử dụng decorator `@CheckPolicies(...)` để chặn truy cập.

### 1.1. Chặn toàn bộ Controller (ví dụ chỉ Admin)
```typescript
import { Controller } from '@nestjs/common';
import { CheckPolicies } from '@modules/authorization/presentation/decorators/check-policies.decorator';
import { Action } from '@modules/authorization/domain/action.enum';

@CheckPolicies((ability) => ability.can(Action.Manage, 'all'))
@Controller('admin-only')
export class AdminController {}
```

### 1.2. Phân quyền chi tiết trên từng Endpoint
```typescript
import { Controller, Get, Post, Delete } from '@nestjs/common';
import { CheckPolicies } from '@modules/authorization/presentation/decorators/check-policies.decorator';
import { Action } from '@modules/authorization/domain/action.enum';
import { UserEntity } from '@modules/user/domain/user.entity';

@Controller('users')
export class UserController {
  @Get()
  @CheckPolicies((ability) => ability.can(Action.Read, UserEntity))
  async findAll() {}

  @Post()
  @CheckPolicies((ability) => ability.can(Action.Create, UserEntity))
  async create() {}

  @Delete(':id')
  @CheckPolicies((ability) => ability.can(Action.Delete, UserEntity))
  async remove() {}
}
```

---

## 2. Thêm Entity Mới Vào Hệ Thống Phân Quyền

Hệ thống **TỰ ĐỘNG NHẬN DIỆN 100%** mọi Entity kế thừa `BaseEntity` (hoặc dùng chuỗi string). Bạn **KHÔNG CẦN** mở `policy.types.ts` để khai báo thủ công.

Khi tạo module/entity mới (ví dụ `ProviderEntity`), bạn chỉ cần cấp quyền theo 1 trong 2 cách:

### Cách A: Cấp quyền động qua API (Không cần sửa code)
Tạo permission mới qua API:
```http
POST /authorization/permissions
{
  "action": "read",
  "subject": "Provider",
  "description": "Xem danh sách nhà cung cấp"
}
```

### Cách B: Thêm Rule mặc định vào `CaslAbilityFactory` (Nếu muốn hardcode fallback)
Mở `src/modules/authorization/application/casl-ability.factory.ts`:
```typescript
if (user?.role === Role.ADMIN) {
  can(Action.Manage, 'all');
} else if (user?.role === Role.MANAGER) {
  can(Action.Read, ProviderEntity);
  can(Action.Update, ProviderEntity);
}
```

---

## 3. Kiểm Tra Quyền Theo Bản Ghi (ABAC - Instance Check)

Áp dụng cho nghiệp vụ: *"Chỉ cho phép sửa/xóa bản ghi do chính mình sở hữu"*.

```typescript
@Patch(':id')
@CheckPolicies((ability) => ability.can(Action.Update, UserEntity))
async update(
  @Param('id') id: string,
  @CurrentUser() currentUser: TokenPayload,
) {
  const targetUser = await this.userService.findOne(id);
  const ability = await this.caslAbilityFactory.createForUser(currentUser);

  if (!ability.can(Action.Update, targetUser)) {
    throw new ForbiddenException('Bạn chỉ có quyền sửa thông tin của chính mình');
  }

  return this.userService.update(id, dto);
}
```

---

## 4. Quản Trị Role & Permission Qua REST API

Tất cả các API này yêu cầu Token có quyền Admin (`manage all`).

### Bước 1: Tạo Permission mới
```http
POST /authorization/permissions
Content-Type: application/json
Authorization: Bearer <ADMIN_TOKEN>

{
  "action": "read",
  "subject": "Provider",
  "description": "Xem nhà cung cấp"
}
```
*(Nếu cần điều kiện ABAC, thêm `"conditions": { "id": "${user.sub}" }`)*

### Bước 2: Tạo Role mới
```http
POST /authorization/roles
Content-Type: application/json
Authorization: Bearer <ADMIN_TOKEN>

{
  "code": "AUDITOR",
  "name": "Kiểm toán viên"
}
```

### Bước 3: Gán danh sách Permission cho Role
```http
POST /authorization/roles/{roleId}/permissions
Content-Type: application/json
Authorization: Bearer <ADMIN_TOKEN>

{
  "permissionIds": [
    "0192f3a1-8e9a-7c3d-b4ef-permission-id-1",
    "0192f3a1-8e9a-7c3d-b4ef-permission-id-2"
  ]
}
```

### Bước 4: Gán Role cho User
```http
PATCH /users/{userId}
Content-Type: application/json
Authorization: Bearer <ADMIN_TOKEN>

{
  "role": "AUDITOR"
}
```

---

## 5. Frontend Lấy Quyền Động

Gọi API sau khi User đăng nhập để lấy danh sách rules nạp vào CASL của Frontend:

```http
GET /authorization/me/abilities
Authorization: Bearer <USER_TOKEN>
```

**Response:**
```json
{
  "rules": [
    ["read", "User"],
    ["read", "Provider"]
  ]
}
```

Frontend nạp vào CASL:
```typescript
import { unpackRules } from '@casl/ability/extra';
ability.update(unpackRules(data.rules));
```

---

## 6. Bảng Tra Cứu API & Lệnh

| Method | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/authorization/roles` | Tạo vai trò mới |
| `GET` | `/authorization/roles` | Danh sách vai trò |
| `GET` | `/authorization/roles/:id` | Chi tiết vai trò |
| `PATCH`| `/authorization/roles/:id` | Cập nhật vai trò |
| `DELETE`| `/authorization/roles/:id` | Xóa vai trò |
| `POST` | `/authorization/roles/:id/permissions` | Gán permissions cho vai trò |
| `GET` | `/authorization/roles/:id/permissions` | Xem permissions của vai trò |
| `POST` | `/authorization/permissions` | Tạo permission mới |
| `GET` | `/authorization/permissions` | Danh mục permissions |
| `DELETE`| `/authorization/permissions/:id` | Xóa permission |
| `GET` | `/authorization/me/abilities` | Frontend lấy rules của user hiện tại |

### Lệnh Database hữu ích
```bash
# Seed dữ liệu quyền và vai trò mặc định (ADMIN, MANAGER, USER)
npm run db:seed:permissions

# Tạo tài khoản Admin test
ADMIN_EMAIL="admin@pq.com" ADMIN_PASSWORD="YourPassword123!" npm run db:seed:admin
```
