# Hướng Dẫn Tạo Module Mới (DDD + Hexagonal)

Tài liệu hướng dẫn tạo một module (bounded context) mới trong dự án **Provider Integration Hub**, theo đúng cấu trúc hiện có của source và kiến trúc **DDD Hexagonal**.

Module mẫu xuyên suốt tài liệu: **`provider`** — quản lý các nhà cung cấp tích hợp. Module tham chiếu có sẵn trong source: `src/modules/user`.

---

## 1. Kiến Trúc Tổng Quan

### Bốn layer trong mỗi module

```
                 ┌──────────────────────────────┐
  HTTP request → │ presentation  (controller)   │  ← adapter vào (driving)
                 └──────────────┬───────────────┘
                                ▼
                 ┌──────────────────────────────┐
                 │ application   (service)      │  ← điều phối use case, log, transaction
                 └──────┬───────────────┬───────┘
                        ▼               ▼ (qua DI token)
                 ┌────────────┐  ┌─────────────────────────────┐
                 │  domain    │  │ infrastructure (repository, │  ← adapter ra (driven)
                 │ (lõi thuần)│◄─│ schema, client provider...) │
                 └────────────┘  └─────────────────────────────┘
```

| Layer | Thư mục | Trách nhiệm | Được phụ thuộc vào |
|---|---|---|---|
| **Domain** | `domain/` | Entity, quy tắc nghiệp vụ, domain error. Lõi thuần, không biết đến NestJS / Drizzle / HTTP | `@common/base/base.entity` — **không gì khác** |
| **Application** | `application/` | Use case: gọi repository, áp dụng quy tắc domain, chuyển domain error thành exception, ghi log | `domain`, `@common/*`, repository **qua DI token** |
| **Infrastructure** | `infrastructure/` | Schema Drizzle, repository, client gọi hệ thống ngoài | `domain`, `@common/base`, `@infrastructure/*` |
| **Presentation** | `presentation/` | Controller: nhận HTTP, gọi service, trả kết quả | `application`, `domain` (chỉ dùng làm type) |

### Quy tắc phụ thuộc (bắt buộc)

- **Chiều phụ thuộc luôn hướng vào domain.** Domain không import bất kỳ layer nào khác.
- ❌ `domain/` import `@nestjs/*`, `drizzle-orm`, `@common/logger`, hoặc file trong `infrastructure/`.
- ❌ `presentation/` gọi thẳng repository — phải đi qua service.
- ❌ `application/` dùng trực tiếp `drizzle-orm` (`eq`, `db.select()`...) — mọi truy vấn nằm trong repository.
- ❌ Module A import file bên trong module B (`@modules/b/infrastructure/...`). Muốn dùng module khác → import **Module** đó và inject **service** được `exports`.

---

## 2. Cấu Trúc Thư Mục

```
src/modules/provider/
├── domain/
│   ├── provider.entity.ts          # Entity + hằng số trạng thái
│   ├── provider.policy.ts          # (tuỳ chọn) quy tắc nghiệp vụ thuần
│   └── provider.errors.ts          # (tuỳ chọn) domain error
├── application/
│   └── provider.service.ts
├── infrastructure/
│   ├── provider.schema.ts          # BẮT BUỘC đặt ở đây và đuôi .schema.ts
│   └── provider.repository.ts
├── presentation/
│   └── provider.controller.ts
└── provider.module.ts
```

### Quy ước đặt tên

| Thành phần | Tên file | Tên class / biến |
|---|---|---|
| Thư mục module | số ít, kebab-case: `provider`, `payment-method` | — |
| Entity | `provider.entity.ts` | `ProviderEntity` |
| Schema | `provider.schema.ts` | bảng số nhiều, snake_case: `providers` / `'providers'` |
| Repository | `provider.repository.ts` | `ProviderRepository`, DI token `'IProviderRepository'` |
| Service | `provider.service.ts` | `ProviderService` |
| Controller | `provider.controller.ts` | `ProviderController`, route số nhiều: `'providers'` |
| Module | `provider.module.ts` | `ProviderModule` |

### Import

Luôn dùng alias, không dùng đường dẫn tương đối `../../..`:

| Alias | Trỏ tới |
|---|---|
| `@common/*` | `src/common/*` |
| `@modules/*` | `src/modules/*` |
| `@infrastructure/*` | `src/infrastructure/*` |

---

## 3. Các Bước Tạo Module

### Bước 1: Domain — Entity

Kế thừa `BaseEntity` (đã có sẵn `id`, `status`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `metadata`). Chỉ khai báo thêm field riêng của module.

```ts
// src/modules/provider/domain/provider.entity.ts
import { BaseEntity } from '@common/base/base.entity';

export const ProviderStatus = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
} as const;

export class ProviderEntity extends BaseEntity {
    code: string;
    name: string;
    baseUrl: string;
}
```

> ⚠️ **Không viết method trong entity.** `BaseRepository` trả về object thuần từ database (không phải instance của class), nên method như `provider.deactivate()` sẽ **không tồn tại** lúc runtime. Quy tắc nghiệp vụ đặt trong `*.policy.ts` (Bước 2).

### Bước 2: Domain — Quy tắc nghiệp vụ & Domain error (tuỳ chọn)

Chỉ tạo khi module có quy tắc nghiệp vụ thật sự. Viết dạng **hàm thuần**: nhận entity, trả kết quả hoặc ném domain error. Không async, không gọi database, không log.

```ts
// src/modules/provider/domain/provider.errors.ts
export class ProviderAlreadyInactiveError extends Error {
    constructor(readonly providerId: string) {
        super(`Provider ${providerId} is already inactive`);
        this.name = 'ProviderAlreadyInactiveError';
    }
}
```

```ts
// src/modules/provider/domain/provider.policy.ts
import { ProviderEntity, ProviderStatus } from '@modules/provider/domain/provider.entity';
import { ProviderAlreadyInactiveError } from '@modules/provider/domain/provider.errors';

export function assertCanDeactivate(provider: ProviderEntity): void {
    if (provider.status === ProviderStatus.INACTIVE) {
        throw new ProviderAlreadyInactiveError(provider.id);
    }
}
```

Domain error **không** kế thừa `HttpException` của NestJS — domain không biết đến HTTP. Việc chuyển sang mã HTTP do application layer làm (Bước 5).

### Bước 3: Infrastructure — Schema

Spread `baseSchema` để có đủ các cột chung, sau đó khai báo cột riêng.

```ts
// src/modules/provider/infrastructure/provider.schema.ts
import { pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '@common/base/base.schema';

export const providers = pgTable('providers', {
    ...baseSchema,
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    baseUrl: varchar('base_url', { length: 500 }).notNull(),
});
```

- File **phải** nằm trong `infrastructure/` và có đuôi `.schema.ts` — drizzle-kit chỉ quét pattern `./src/modules/**/infrastructure/*.schema.ts`. Đặt sai chỗ sẽ không sinh được migration.
- Tên cột trong database dùng `snake_case`, tên property trong code dùng `camelCase`.

### Bước 4: Infrastructure — Repository

Kế thừa `BaseRepository` để có sẵn CRUD (`create`, `findById`, `findAll`, `update`, `delete`). Chỉ viết thêm các truy vấn riêng.

```ts
// src/modules/provider/infrastructure/provider.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import { providers } from '@modules/provider/infrastructure/provider.schema';

@Injectable()
export class ProviderRepository extends BaseRepository<ProviderEntity> {
    constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
        super(db, providers);
    }

    async findByCode(code: string): Promise<ProviderEntity | null> {
        const result = await this.db.select().from(providers).where(eq(providers.code, code));
        return (result[0] as ProviderEntity) ?? null;
    }
}
```

- Truy vấn riêng dùng trực tiếp biến bảng `providers` (có type đầy đủ), không dùng `this.table` (kiểu `any`).
- Repository **không** ném exception nghiệp vụ, **không** throw `NotFoundException` — không tìm thấy thì trả `null`, service quyết định xử lý.

### Bước 5: Application — Service

Kế thừa `BaseService` để có sẵn CRUD (`create`, `findAll`, `findOne` — tự ném `NotFoundException`, `update`, `remove`). Viết thêm use case riêng.

```ts
// src/modules/provider/application/provider.service.ts
import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { BaseService } from '@common/base/base.service';
import { LoggerPort, LogLayer } from '@common/logger';
import { ProviderEntity, ProviderStatus } from '@modules/provider/domain/provider.entity';
import { ProviderAlreadyInactiveError } from '@modules/provider/domain/provider.errors';
import { assertCanDeactivate } from '@modules/provider/domain/provider.policy';
import { ProviderRepository } from '@modules/provider/infrastructure/provider.repository';

@Injectable()
export class ProviderService extends BaseService<ProviderEntity> {
    private readonly logger: LoggerPort;

    constructor(
        @Inject('IProviderRepository')
        private readonly providerRepository: ProviderRepository,
        logger: LoggerPort,
    ) {
        super(providerRepository);
        this.logger = logger.child(LogLayer.APPLICATION, 'Provider', ProviderService.name);
    }

    async deactivate(id: string): Promise<ProviderEntity> {
        const provider = await this.findOne(id);

        try {
            assertCanDeactivate(provider);
        } catch (err) {
            if (err instanceof ProviderAlreadyInactiveError) throw new ConflictException(err.message);
            throw err;
        }

        const updated = await this.providerRepository.update(id, { status: ProviderStatus.INACTIVE });
        this.logger.info('Provider deactivated', { providerId: id });
        return updated;
    }
}
```

- Repository được inject qua **token chuỗi** `'I<Name>Repository'`, không inject thẳng class.
- Service là nơi **duy nhất** chuyển domain error → exception của NestJS (`ConflictException`, `BadRequestException`...).
- Logger theo tag `[APP][<BoundedContext>][<ClassName>]` — xem chi tiết tại [huong-dan-logging.md](./huong-dan-logging.md).

### Bước 6: Presentation — Controller

Kế thừa `BaseController` sẽ tự có 5 endpoint CRUD:

| Method | Route | Gọi tới |
|---|---|---|
| `POST` | `/providers` | `service.create(body)` |
| `GET` | `/providers` | `service.findAll(query)` |
| `GET` | `/providers/:id` | `service.findOne(id)` |
| `PATCH` | `/providers/:id` | `service.update(id, body)` |
| `DELETE` | `/providers/:id` | `service.remove(id)` |

Endpoint riêng khai báo thêm trong class:

```ts
// src/modules/provider/presentation/provider.controller.ts
import { Controller, Param, Post } from '@nestjs/common';
import { BaseController } from '@common/base/base.controller';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import { ProviderService } from '@modules/provider/application/provider.service';

@Controller('providers')
export class ProviderController extends BaseController<ProviderEntity> {
    constructor(private readonly providerService: ProviderService) {
        super(providerService);
    }

    @Post(':id/deactivate')
    async deactivate(@Param('id') id: string) {
        return this.providerService.deactivate(id);
    }
}
```

- Controller chỉ nhận request → gọi service → trả kết quả. **Không** chứa logic nghiệp vụ, **không** try/catch, **không** tự log (access log `[HTTP]` đã tự động).
- Nếu module có field nhạy cảm (mật khẩu, API key...), **phải** override các endpoint kế thừa để loại bỏ field đó khỏi response — `BaseController` trả nguyên bản ghi từ database.

### Bước 7: Đăng ký Module

```ts
// src/modules/provider/provider.module.ts
import { Module } from '@nestjs/common';
import { ProviderController } from '@modules/provider/presentation/provider.controller';
import { ProviderService } from '@modules/provider/application/provider.service';
import { ProviderRepository } from '@modules/provider/infrastructure/provider.repository';

@Module({
    controllers: [ProviderController],
    providers: [
        ProviderService,
        {
            provide: 'IProviderRepository',
            useClass: ProviderRepository,
        },
    ],
    exports: [ProviderService],
})
export class ProviderModule {}
```

Thêm vào `src/app.module.ts`:

```ts
@Module({
  imports: [LoggerModule, DrizzleModule, UserModule, ProviderModule],
})
export class AppModule {}
```

- `DrizzleModule` và `LoggerModule` là `@Global()` nên **không cần** import lại trong module con.
- Chỉ `exports` **service** — không bao giờ export repository ra ngoài module.

### Bước 8: Tạo Migration

```bash
npm run db:generate   # sinh file .sql trong ./drizzle/migrations — kiểm tra lại nội dung
npm run db:migrate    # áp dụng vào database
```

Quy trình và lưu ý chi tiết: [huong-dan-migration.md](./huong-dan-migration.md).

### Bước 9: Kiểm tra

```bash
npx tsc --noEmit      # type-check
npm test              # unit test
npm run start:dev
```

Log khởi động phải có các dòng route mới:

```
INFO    [SYS][RoutesResolver] ProviderController {/providers}:
INFO    [SYS][RouterExplorer] Mapped {/providers/:id/deactivate, POST} route
```

---

## 4. Viết Unit Test

- File test đặt **cạnh file cần test**, đuôi `.spec.ts` (ví dụ `provider.policy.spec.ts`).
- **Domain policy** là hàm thuần → test trực tiếp, không cần mock, không cần NestJS. Đây là phần nên có test đầu tiên.
- **Service** → mock repository qua token `'IProviderRepository'` và mock `LoggerPort` bằng `Test.createTestingModule`.

```ts
// src/modules/provider/domain/provider.policy.spec.ts
import { ProviderEntity, ProviderStatus } from '@modules/provider/domain/provider.entity';
import { ProviderAlreadyInactiveError } from '@modules/provider/domain/provider.errors';
import { assertCanDeactivate } from '@modules/provider/domain/provider.policy';

describe('assertCanDeactivate', () => {
    it('ném lỗi khi provider đã inactive', () => {
        const provider = { id: 'p1', status: ProviderStatus.INACTIVE } as ProviderEntity;
        expect(() => assertCanDeactivate(provider)).toThrow(ProviderAlreadyInactiveError);
    });
});
```

---

## 5. Checklist Khi Review Module Mới

**Cấu trúc**
- [ ] Đủ 4 thư mục `domain / application / infrastructure / presentation` và file `<name>.module.ts`.
- [ ] Tên file, class, bảng, route đúng quy ước ở mục 2.
- [ ] Dùng alias `@common`, `@modules`, `@infrastructure` — không có `../../..`.

**Domain**
- [ ] Entity kế thừa `BaseEntity`, không có method.
- [ ] Không import `@nestjs/*`, `drizzle-orm`, logger hay infrastructure.
- [ ] Domain error kế thừa `Error`, không kế thừa `HttpException`.

**Infrastructure**
- [ ] Schema nằm trong `infrastructure/`, đuôi `.schema.ts`, có `...baseSchema`.
- [ ] Repository kế thừa `BaseRepository`, trả `null` khi không tìm thấy.
- [ ] Đã chạy `db:generate` và commit file migration.

**Application**
- [ ] Service kế thừa `BaseService`, inject repository qua token `'I<Name>Repository'`.
- [ ] Không dùng `drizzle-orm` trực tiếp.
- [ ] Domain error được chuyển thành exception NestJS phù hợp.
- [ ] Logger gắn tag `[APP][<BoundedContext>][<ClassName>]`.

**Presentation**
- [ ] Controller kế thừa `BaseController`, không chứa logic nghiệp vụ.
- [ ] Không trả field nhạy cảm ra response.

**Module**
- [ ] Chỉ export service; đã thêm vào `AppModule`.
