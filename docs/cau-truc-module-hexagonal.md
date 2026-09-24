# Template Module Hexagonal — Mỗi File Để Làm Gì, Tại Sao Cần

Tài liệu mô tả **bộ khung đầy đủ** của một module theo **DDD + Hexagonal (Ports & Adapters)**: module có những file nào, mỗi file chịu trách nhiệm gì, tại sao phải tách ra, và khi nào được phép bỏ qua.

- Dùng làm **template** khi tạo module mới: copy cây thư mục ở mục 2, đổi `provider` thành tên module.
- Module mẫu: **`provider`** — quản lý nhà cung cấp tích hợp (có mã, tên, URL, trạng thái, và cần kiểm tra kết nối tới hệ thống ngoài).
- Các bước tạo module tương thích với base class hiện tại: xem [huong-dan-tao-module.md](./huong-dan-tao-module.md). Khác biệt giữa template này và source hiện tại: xem mục 7.

---

## 1. Ý Tưởng Cốt Lõi Trong 30 Giây

**Hexagonal** chia code thành 2 phần:

- **Lõi (bên trong)** — `domain` + `application`: nghiệp vụ thuần. Không biết đang chạy trên HTTP hay queue, lưu Postgres hay Mongo.
- **Adapter (bên ngoài)** — `presentation` + `infrastructure`: nối lõi với thế giới thật (HTTP, database, API của bên thứ ba).

Hai phần nói chuyện với nhau qua **port** — một abstract class do **lõi định nghĩa**, **adapter implement**.

```
                    ┌──────────────── LÕI ────────────────┐
  HTTP ─► Controller ─►  Service ──► Entity / VO / Policy │
  (adapter vào)     │      │                              │
                    │      ├──► RepositoryPort ◄──────────┼── ProviderRepository (Drizzle)   ─► Postgres
                    │      └──► ConnectionPort ◄──────────┼── HttpProviderConnectionAdapter  ─► API ngoài
                    └─────────────────────────────────────┘      (adapter ra)
```

**Quy tắc vàng:** mũi tên `import` luôn chỉ **vào trong**. Lõi không bao giờ import adapter. Đổi Postgres sang database khác → chỉ viết adapter mới, lõi không sửa một dòng.

---

## 2. Cây Thư Mục Template

```
src/modules/provider/
│
├── domain/                                   ── LÕI: nghiệp vụ thuần
│   ├── provider.entity.ts                    ★ Aggregate root: dữ liệu + hành vi
│   ├── provider-code.vo.ts                   ○ Value object: giá trị tự kiểm tra hợp lệ
│   ├── provider.errors.ts                    ★ Domain error
│   ├── provider.events.ts                    ○ Domain event
│   └── provider.repository.port.ts           ★ Port ra: hợp đồng lưu trữ
│
├── application/                              ── LÕI: điều phối use case
│   ├── provider.service.ts                   ★ Use case
│   ├── provider.commands.ts                  ★ Input của use case
│   ├── provider-connection.port.ts           ○ Port ra: hệ thống ngoài (không phải DB)
│   └── provider.service.spec.ts              ★ Test use case bằng fake adapter
│
├── infrastructure/                           ── ADAPTER RA
│   ├── provider.schema.ts                    ★ Bảng Drizzle
│   ├── provider.mapper.ts                    ★ Chuyển đổi DB row ⇄ entity
│   ├── provider.repository.ts                ★ Implement RepositoryPort
│   └── http-provider-connection.adapter.ts   ○ Implement ConnectionPort
│
├── presentation/                             ── ADAPTER VÀO
│   ├── provider.controller.ts                ★ HTTP endpoint
│   └── dto/
│       ├── create-provider.request.ts        ★ Body request
│       └── provider.response.ts              ★ Dữ liệu trả ra
│
└── provider.module.ts                        ★ Nối port với adapter (DI)
```

★ = bắt buộc &nbsp;&nbsp; ○ = chỉ tạo khi cần (điều kiện ở từng file bên dưới)

### Bảng tóm tắt

| File | Layer | Vai trò | Nếu thiếu thì sao |
|---|---|---|---|
| `provider.entity.ts` | Domain | Giữ dữ liệu + quy tắc nghiệp vụ | Quy tắc rải rác khắp service/controller, trùng lặp, dễ bỏ sót |
| `provider-code.vo.ts` | Domain | Một giá trị có luật riêng, tự validate | Validate lặp lại ở nhiều nơi, dữ liệu sai lọt vào DB |
| `provider.errors.ts` | Domain | Lỗi nghiệp vụ có tên | Chỉ có `Error('...')` chung chung, không map được sang mã HTTP |
| `provider.events.ts` | Domain | Ghi nhận "điều đã xảy ra" | Module khác phải gọi chéo trực tiếp → dính chặt nhau |
| `provider.repository.port.ts` | Domain | Hợp đồng lưu trữ | Lõi phụ thuộc Drizzle, không test được nếu không có DB |
| `provider.service.ts` | Application | Điều phối một use case | Controller ôm logic, không tái sử dụng được từ queue/cron |
| `provider.commands.ts` | Application | Input của use case | Service nhận DTO HTTP → lõi dính vào HTTP |
| `provider-connection.port.ts` | Application | Hợp đồng gọi hệ thống ngoài | Service gọi `fetch` trực tiếp, không mock được |
| `provider.service.spec.ts` | Application | Test use case | Chỉ phát hiện lỗi nghiệp vụ khi chạy thật |
| `provider.schema.ts` | Infrastructure | Cấu trúc bảng | Không có migration |
| `provider.mapper.ts` | Infrastructure | Row ⇄ entity | Entity bị ép theo hình dạng bảng DB, mất method |
| `provider.repository.ts` | Infrastructure | Truy vấn DB thật | — |
| `http-provider-connection.adapter.ts` | Infrastructure | Gọi API ngoài thật | — |
| `provider.controller.ts` | Presentation | Nhận HTTP, gọi service | — |
| `create-provider.request.ts` | Presentation | Hình dạng body HTTP | Client gửi field lạ vẫn lọt vào |
| `provider.response.ts` | Presentation | Chọn field trả ra | Lộ field nội bộ / nhạy cảm ra ngoài |
| `provider.module.ts` | — | Chọn adapter nào cắm vào port nào | Nest không biết inject gì |

---

## 3. Domain — Chi Tiết Từng File

Domain là **trái tim** của module. Luật chung cho mọi file trong `domain/`:

- ❌ Không import `@nestjs/*`, `drizzle-orm`, logger, hay bất cứ thứ gì ngoài `domain/` của chính nó.
- ❌ Không async, không gọi database, không gọi HTTP.
- ✅ Test được chỉ bằng `new` và gọi hàm — không cần NestJS, không cần mock.

### 3.1. `provider.entity.ts` — Aggregate Root ★

**Là gì:** Class đại diện cho một "thứ" có định danh (`id`) và vòng đời trong nghiệp vụ. **Aggregate root** nghĩa là mọi thay đổi trạng thái của provider đều phải đi qua class này.

**Tại sao cần:** Gom **dữ liệu và luật** vào một chỗ. Luật "provider đã inactive thì không deactivate lại được" nằm trong `deactivate()` — không ai có thể quên kiểm tra, vì không có cách nào khác để đổi `status`.

```ts
// src/modules/provider/domain/provider.entity.ts
import { ProviderCode } from '@modules/provider/domain/provider-code.vo';
import { ProviderAlreadyInactiveError } from '@modules/provider/domain/provider.errors';
import { ProviderDeactivatedEvent, ProviderDomainEvent } from '@modules/provider/domain/provider.events';

export type ProviderStatus = 'ACTIVE' | 'INACTIVE';

export interface ProviderProps {
    id: string;
    code: ProviderCode;
    name: string;
    baseUrl: string;
    status: ProviderStatus;
}

export class ProviderEntity {
    private events: ProviderDomainEvent[] = [];

    private constructor(private readonly props: ProviderProps) {}

    /** Tạo mới — áp dụng luật khởi tạo */
    static create(input: Omit<ProviderProps, 'status'>): ProviderEntity {
        return new ProviderEntity({ ...input, status: 'ACTIVE' });
    }

    /** Dựng lại từ database — KHÔNG áp dụng luật, dữ liệu đã hợp lệ từ trước */
    static restore(props: ProviderProps): ProviderEntity {
        return new ProviderEntity(props);
    }

    get id() { return this.props.id; }
    get code() { return this.props.code; }
    get name() { return this.props.name; }
    get baseUrl() { return this.props.baseUrl; }
    get status() { return this.props.status; }

    deactivate(): void {
        if (this.props.status === 'INACTIVE') throw new ProviderAlreadyInactiveError(this.id);
        this.props.status = 'INACTIVE';
        this.events.push(new ProviderDeactivatedEvent(this.id));
    }

    /** Lấy ra các event đã phát sinh và xoá khỏi entity */
    pullEvents(): ProviderDomainEvent[] {
        const events = this.events;
        this.events = [];
        return events;
    }
}
```

**Điểm cần chú ý:**
- `constructor` là `private` → bắt buộc đi qua `create()` (có luật) hoặc `restore()` (từ DB).
- Không có setter công khai → trạng thái chỉ đổi qua method nghiệp vụ (`deactivate()`), không `provider.status = 'X'` tuỳ tiện.
- `id` được truyền vào, không tự sinh — sinh id là việc của application (xem 4.1).

### 3.2. `provider-code.vo.ts` — Value Object ○

**Là gì:** Một giá trị **không có định danh**, so sánh bằng nội dung, **bất biến**, và **luôn hợp lệ** — đã tạo ra được là chắc chắn đúng.

**Tại sao cần:** Nếu `code` chỉ là `string`, mọi nơi nhận code đều phải tự hỏi "chuỗi này đã được chuẩn hoá chưa?". Với `ProviderCode`, có object là đã hợp lệ.

**Khi nào tạo:** Khi một giá trị có **luật riêng** (định dạng, khoảng giá trị, chuẩn hoá): mã, email, số tiền + tiền tệ, số điện thoại, khoảng thời gian... Field chỉ là text tự do (`name`) → dùng `string`, không cần VO.

```ts
// src/modules/provider/domain/provider-code.vo.ts
import { InvalidProviderCodeError } from '@modules/provider/domain/provider.errors';

export class ProviderCode {
    private constructor(readonly value: string) {}

    static create(raw: string): ProviderCode {
        const value = raw.trim().toUpperCase();
        if (!/^[A-Z0-9_]{2,50}$/.test(value)) throw new InvalidProviderCodeError(raw);
        return new ProviderCode(value);
    }

    equals(other: ProviderCode): boolean {
        return this.value === other.value;
    }
}
```

### 3.3. `provider.errors.ts` — Domain Error ★

**Là gì:** Các lỗi **có tên** mô tả vi phạm luật nghiệp vụ.

**Tại sao cần:** Tầng ngoài cần phân biệt lỗi để phản hồi đúng (409 hay 400 hay 404). Với `throw new Error('...')` thì chỉ còn cách so sánh chuỗi message — rất dễ vỡ.

**Tại sao không dùng `HttpException` của Nest:** Domain không biết HTTP tồn tại. Cùng một lỗi có thể xảy ra trong HTTP request, trong job queue, trong cron — chỉ HTTP mới cần mã 409.

```ts
// src/modules/provider/domain/provider.errors.ts
export abstract class ProviderDomainError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

export class InvalidProviderCodeError extends ProviderDomainError {
    constructor(readonly raw: string) {
        super(`Invalid provider code: "${raw}"`);
    }
}

export class ProviderCodeAlreadyExistsError extends ProviderDomainError {
    constructor(readonly code: string) {
        super(`Provider code ${code} already exists`);
    }
}

export class ProviderAlreadyInactiveError extends ProviderDomainError {
    constructor(readonly providerId: string) {
        super(`Provider ${providerId} is already inactive`);
    }
}
```

### 3.4. `provider.events.ts` — Domain Event ○

**Là gì:** Bản ghi một sự kiện **đã xảy ra** trong nghiệp vụ (đặt tên ở thì quá khứ: `ProviderDeactivated`).

**Tại sao cần:** Khi provider bị tắt, module `payment` có thể cần dừng giao dịch, module `notification` cần gửi email. Nếu `ProviderService` gọi thẳng các module đó → `provider` phải biết về tất cả, thêm module mới lại phải sửa `provider`. Với event: `provider` chỉ báo "tôi đã bị tắt", ai quan tâm thì tự lắng nghe.

**Khi nào tạo:** Khi có (hoặc chắc chắn sắp có) module khác cần phản ứng với thay đổi của module này. Chưa có ai lắng nghe → chưa cần.

```ts
// src/modules/provider/domain/provider.events.ts
export class ProviderDeactivatedEvent {
    readonly occurredAt = new Date();
    constructor(readonly providerId: string) {}
}

export type ProviderDomainEvent = ProviderDeactivatedEvent;
```

Entity chỉ **ghi lại** event (`this.events.push`); việc **phát** event đi (qua `EventEmitter`, message queue...) là của application sau khi lưu thành công.

### 3.5. `provider.repository.port.ts` — Port Lưu Trữ ★

**Là gì:** Hợp đồng "lõi cần lưu/lấy provider như thế nào", viết bằng **ngôn ngữ nghiệp vụ** — không có SQL, không có Drizzle.

**Tại sao cần:** Đây là điểm mấu chốt của Hexagonal. Service chỉ biết port → test service bằng repository giả trong bộ nhớ (mục 4.4), đổi database không ảnh hưởng lõi.

**Tại sao đặt ở domain, không phải infrastructure:** Chủ sở hữu hợp đồng là **bên cần** (lõi), không phải bên cung cấp. Infrastructure phải chiều theo lõi, không phải ngược lại.

**Tại sao là `abstract class`, không phải `interface`:** Interface của TypeScript biến mất khi chạy, Nest không dùng làm DI token được. Abstract class vừa là hợp đồng vừa là token — giống cách `LoggerPort` đang làm.

```ts
// src/modules/provider/domain/provider.repository.port.ts
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import { ProviderCode } from '@modules/provider/domain/provider-code.vo';

export abstract class ProviderRepositoryPort {
    abstract findById(id: string): Promise<ProviderEntity | null>;
    abstract findByCode(code: ProviderCode): Promise<ProviderEntity | null>;
    /** Tạo mới hoặc cập nhật toàn bộ aggregate */
    abstract save(provider: ProviderEntity): Promise<void>;
}
```

Chỉ khai báo method mà nghiệp vụ **thật sự dùng**. Không thêm sẵn `findAll`, `delete`... "cho đủ bộ".

---

## 4. Application — Chi Tiết Từng File

Application **điều phối**: lấy dữ liệu qua port → giao cho domain xử lý → lưu lại qua port → ghi log. Bản thân nó **không chứa luật nghiệp vụ** — luật nằm ở domain.

### 4.1. `provider.service.ts` — Use Case ★

**Tại sao cần:** Controller chỉ là một trong nhiều "cửa vào". Cùng use case "deactivate provider" có thể được gọi từ HTTP, từ job queue, từ cron. Logic nằm ở service → mọi cửa vào dùng chung.

**Nhiệm vụ điển hình của một method:**
1. Nhận command.
2. Lấy entity qua repository port (không có → 404).
3. Gọi method của entity / VO — luật nghiệp vụ chạy ở đây.
4. Lưu lại qua port, phát event.
5. Ghi log.
6. Chuyển domain error → exception HTTP của Nest.

```ts
// src/modules/provider/application/provider.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { LoggerPort, LogLayer } from '@common/logger';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import { ProviderCode } from '@modules/provider/domain/provider-code.vo';
import {
    InvalidProviderCodeError,
    ProviderAlreadyInactiveError,
    ProviderCodeAlreadyExistsError,
} from '@modules/provider/domain/provider.errors';
import { ProviderRepositoryPort } from '@modules/provider/domain/provider.repository.port';
import { ProviderConnectionPort } from '@modules/provider/application/provider-connection.port';
import { CreateProviderCommand } from '@modules/provider/application/provider.commands';

@Injectable()
export class ProviderService {
    private readonly logger: LoggerPort;

    constructor(
        private readonly providerRepository: ProviderRepositoryPort,
        private readonly providerConnection: ProviderConnectionPort,
        logger: LoggerPort,
    ) {
        this.logger = logger.child(LogLayer.APPLICATION, 'Provider', ProviderService.name);
    }

    async create(command: CreateProviderCommand): Promise<ProviderEntity> {
        try {
            const code = ProviderCode.create(command.code);
            if (await this.providerRepository.findByCode(code)) {
                throw new ProviderCodeAlreadyExistsError(code.value);
            }
            if (!(await this.providerConnection.check(command.baseUrl))) {
                throw new BadRequestException(`Cannot connect to ${command.baseUrl}`);
            }

            const provider = ProviderEntity.create({ id: uuidv7(), code, name: command.name, baseUrl: command.baseUrl });
            await this.providerRepository.save(provider);

            this.logger.info('Provider created', { providerId: provider.id, code: code.value });
            return provider;
        } catch (err) {
            throw this.toHttpError(err);
        }
    }

    async getById(id: string): Promise<ProviderEntity> {
        const provider = await this.providerRepository.findById(id);
        if (!provider) throw new NotFoundException(`Provider ${id} not found`);
        return provider;
    }

    async deactivate(id: string): Promise<ProviderEntity> {
        const provider = await this.getById(id);
        try {
            provider.deactivate();
        } catch (err) {
            throw this.toHttpError(err);
        }

        await this.providerRepository.save(provider);
        // Phát event sau khi lưu thành công (EventEmitter / message queue...)
        provider.pullEvents();

        this.logger.info('Provider deactivated', { providerId: id });
        return provider;
    }

    /** Nơi DUY NHẤT dịch domain error sang mã HTTP */
    private toHttpError(err: unknown): unknown {
        if (err instanceof InvalidProviderCodeError) return new BadRequestException(err.message);
        if (err instanceof ProviderCodeAlreadyExistsError) return new ConflictException(err.message);
        if (err instanceof ProviderAlreadyInactiveError) return new ConflictException(err.message);
        return err;
    }
}
```

**Chú ý:** Service inject `ProviderRepositoryPort` và `ProviderConnectionPort` — **không** import bất kỳ file nào trong `infrastructure/`. Module (mục 6) quyết định adapter nào được cắm vào.

### 4.2. `provider.commands.ts` — Input Của Use Case ★

**Là gì:** Kiểu dữ liệu đầu vào cho từng use case, thuộc về lõi.

**Tại sao không dùng thẳng DTO của controller:** DTO HTTP (`CreateProviderRequest`) thuộc presentation, có thể mang decorator validate, tên field theo API công khai. Nếu service nhận DTO HTTP → lõi phụ thuộc vào HTTP, và job queue muốn gọi use case lại phải giả lập một HTTP DTO.

```ts
// src/modules/provider/application/provider.commands.ts
export interface CreateProviderCommand {
    code: string;
    name: string;
    baseUrl: string;
}
```

### 4.3. `provider-connection.port.ts` — Port Ra Hệ Thống Ngoài ○

**Là gì:** Hợp đồng cho mọi thứ lõi cần từ bên ngoài **mà không phải database**: gọi API đối tác, gửi email, đọc file từ S3...

**Tại sao đặt ở application (không phải domain):** Đây là nhu cầu của **use case** (bước "kiểm tra kết nối trước khi tạo"), không phải một khái niệm nghiệp vụ cốt lõi. Repository port thì đặt ở domain vì nó gắn trực tiếp với aggregate.

**Khi nào tạo:** Khi use case gọi bất kỳ hệ thống ngoài nào. **Không bao giờ** gọi `fetch` / SDK bên thứ ba trực tiếp trong service.

```ts
// src/modules/provider/application/provider-connection.port.ts
export abstract class ProviderConnectionPort {
    abstract check(baseUrl: string): Promise<boolean>;
}
```

### 4.4. `provider.service.spec.ts` — Test Use Case ★

**Tại sao cần:** Đây là **phần thưởng** của Hexagonal. Vì service chỉ biết port, ta cắm **adapter giả trong bộ nhớ** vào — test chạy trong vài mili giây, không cần database, không cần mạng.

```ts
// src/modules/provider/application/provider.service.spec.ts
import { ConflictException } from '@nestjs/common';
import { LoggerPort } from '@common/logger';
import { ProviderService } from '@modules/provider/application/provider.service';
import { ProviderConnectionPort } from '@modules/provider/application/provider-connection.port';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import { ProviderCode } from '@modules/provider/domain/provider-code.vo';
import { ProviderRepositoryPort } from '@modules/provider/domain/provider.repository.port';

class InMemoryProviderRepository extends ProviderRepositoryPort {
    readonly items = new Map<string, ProviderEntity>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByCode(code: ProviderCode) { return [...this.items.values()].find((p) => p.code.equals(code)) ?? null; }
    async save(provider: ProviderEntity) { this.items.set(provider.id, provider); }
}

class FakeConnection extends ProviderConnectionPort {
    ok = true;
    async check() { return this.ok; }
}

const silentLogger = { child: () => silentLogger, info() {}, warn() {}, error() {}, debug() {}, verbose() {} } as LoggerPort;

describe('ProviderService', () => {
    let repo: InMemoryProviderRepository;
    let service: ProviderService;

    beforeEach(() => {
        repo = new InMemoryProviderRepository();
        service = new ProviderService(repo, new FakeConnection(), silentLogger);
    });

    it('tạo provider với code đã chuẩn hoá', async () => {
        const provider = await service.create({ code: ' vnpay ', name: 'VNPay', baseUrl: 'https://vnpay.vn' });
        expect(provider.code.value).toBe('VNPAY');
        expect(repo.items.size).toBe(1);
    });

    it('trả 409 khi trùng code', async () => {
        await service.create({ code: 'VNPAY', name: 'VNPay', baseUrl: 'https://vnpay.vn' });
        await expect(service.create({ code: 'vnpay', name: 'X', baseUrl: 'https://x.vn' })).rejects.toThrow(ConflictException);
    });

    it('trả 409 khi deactivate 2 lần', async () => {
        const provider = await service.create({ code: 'MOMO', name: 'MoMo', baseUrl: 'https://momo.vn' });
        await service.deactivate(provider.id);
        await expect(service.deactivate(provider.id)).rejects.toThrow(ConflictException);
    });
});
```

---

## 5. Adapter — Chi Tiết Từng File

### 5.1. `infrastructure/provider.schema.ts` — Bảng Database ★

**Là gì:** Định nghĩa bảng cho Drizzle, nguồn để sinh migration.

**Tại sao tách khỏi entity:** Bảng DB và entity **khác nhau về mục đích**. Bảng tối ưu cho lưu trữ (`snake_case`, cột audit, index); entity tối ưu cho nghiệp vụ (VO, method, ẩn trạng thái). Gộp làm một → mỗi lần đổi DB phải sửa nghiệp vụ và ngược lại.

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

export type ProviderRow = typeof providers.$inferSelect;
export type NewProviderRow = typeof providers.$inferInsert;
```

> Bắt buộc nằm trực tiếp trong `infrastructure/` và có đuôi `.schema.ts` — drizzle-kit chỉ quét `./src/modules/**/infrastructure/*.schema.ts`.

### 5.2. `infrastructure/provider.mapper.ts` — Chuyển Đổi Row ⇄ Entity ★

**Là gì:** Hai hàm: `toDomain` (row DB → entity) và `toPersistence` (entity → row DB).

**Tại sao cần:**
- Database trả về **object thuần**, không có method `deactivate()`. Mapper gọi `ProviderEntity.restore()` để có **instance thật**.
- Chuyển `string` ⇄ `ProviderCode`, `snake_case` ⇄ `camelCase`, và mọi khác biệt hình dạng khác — **ở một chỗ duy nhất**.

```ts
// src/modules/provider/infrastructure/provider.mapper.ts
import { ProviderEntity, ProviderStatus } from '@modules/provider/domain/provider.entity';
import { ProviderCode } from '@modules/provider/domain/provider-code.vo';
import { NewProviderRow, ProviderRow } from '@modules/provider/infrastructure/provider.schema';

export const ProviderMapper = {
    toDomain(row: ProviderRow): ProviderEntity {
        return ProviderEntity.restore({
            id: row.id,
            code: ProviderCode.create(row.code),
            name: row.name,
            baseUrl: row.baseUrl,
            status: row.status as ProviderStatus,
        });
    },

    toPersistence(entity: ProviderEntity): NewProviderRow {
        return {
            id: entity.id,
            code: entity.code.value,
            name: entity.name,
            baseUrl: entity.baseUrl,
            status: entity.status,
            updatedAt: new Date(),
        };
    },
};
```

### 5.3. `infrastructure/provider.repository.ts` — Adapter Lưu Trữ ★

**Là gì:** Implement `ProviderRepositoryPort` bằng Drizzle + Postgres.

**Tại sao đây là nơi duy nhất có SQL:** Mọi chi tiết database (`eq`, `onConflictDoUpdate`, transaction...) bị nhốt trong file này. Lõi chỉ thấy `findById`, `save`.

```ts
// src/modules/provider/infrastructure/provider.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import { ProviderCode } from '@modules/provider/domain/provider-code.vo';
import { ProviderRepositoryPort } from '@modules/provider/domain/provider.repository.port';
import { providers } from '@modules/provider/infrastructure/provider.schema';
import { ProviderMapper } from '@modules/provider/infrastructure/provider.mapper';

@Injectable()
export class ProviderRepository extends ProviderRepositoryPort {
    constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {
        super();
    }

    async findById(id: string): Promise<ProviderEntity | null> {
        const [row] = await this.db.select().from(providers).where(eq(providers.id, id));
        return row ? ProviderMapper.toDomain(row) : null;
    }

    async findByCode(code: ProviderCode): Promise<ProviderEntity | null> {
        const [row] = await this.db.select().from(providers).where(eq(providers.code, code.value));
        return row ? ProviderMapper.toDomain(row) : null;
    }

    async save(provider: ProviderEntity): Promise<void> {
        const row = ProviderMapper.toPersistence(provider);
        await this.db.insert(providers).values(row).onConflictDoUpdate({ target: providers.id, set: row });
    }
}
```

### 5.4. `infrastructure/http-provider-connection.adapter.ts` — Adapter Hệ Thống Ngoài ○

**Là gì:** Implement `ProviderConnectionPort` bằng HTTP thật. Logger gắn tag `[INFRA]`.

**Tại sao tách:** Timeout, retry, header xác thực, SDK của đối tác... đều là chi tiết kỹ thuật, không phải nghiệp vụ. Đổi thư viện HTTP hay đổi đối tác → chỉ sửa file này.

```ts
// src/modules/provider/infrastructure/http-provider-connection.adapter.ts
import { Injectable } from '@nestjs/common';
import { LoggerPort, LogLayer } from '@common/logger';
import { ProviderConnectionPort } from '@modules/provider/application/provider-connection.port';

@Injectable()
export class HttpProviderConnectionAdapter extends ProviderConnectionPort {
    private readonly logger: LoggerPort;

    constructor(logger: LoggerPort) {
        super();
        this.logger = logger.child(LogLayer.INFRASTRUCTURE, 'Provider', HttpProviderConnectionAdapter.name);
    }

    async check(baseUrl: string): Promise<boolean> {
        try {
            const res = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            return res.status < 500;
        } catch (err) {
            this.logger.warn('Provider connection check failed', { baseUrl, reason: (err as Error).message });
            return false;
        }
    }
}
```

### 5.5. `presentation/dto/create-provider.request.ts` — Body Request ★

**Là gì:** Hình dạng dữ liệu client gửi lên — là **hợp đồng API công khai**.

**Tại sao tách khỏi command:** API công khai và use case thay đổi với tốc độ khác nhau. Đổi tên field trên API (vì client yêu cầu) không được kéo theo sửa lõi.

```ts
// src/modules/provider/presentation/dto/create-provider.request.ts
export class CreateProviderRequest {
    code: string;
    name: string;
    baseUrl: string;
}
```

> Dự án **chưa cài** `class-validator` / `ValidationPipe`, nên hiện DTO chỉ có tác dụng về type. Khi cài, gắn decorator validate (`@IsString()`, `@IsUrl()`...) vào chính class này.

### 5.6. `presentation/dto/provider.response.ts` — Dữ Liệu Trả Ra ★

**Là gì:** Chọn chính xác field nào được trả về cho client.

**Tại sao cần:** Không bao giờ trả thẳng entity hay row DB — sẽ lộ field nội bộ (và nhạy cảm như `password`, `apiKey`) ra ngoài, đồng thời mọi thay đổi entity sẽ âm thầm làm đổi API.

```ts
// src/modules/provider/presentation/dto/provider.response.ts
import { ProviderEntity } from '@modules/provider/domain/provider.entity';

export class ProviderResponse {
    id: string;
    code: string;
    name: string;
    baseUrl: string;
    status: string;

    static from(entity: ProviderEntity): ProviderResponse {
        return {
            id: entity.id,
            code: entity.code.value,
            name: entity.name,
            baseUrl: entity.baseUrl,
            status: entity.status,
        };
    }
}
```

### 5.7. `presentation/provider.controller.ts` — Adapter Vào ★

**Là gì:** Dịch HTTP → command → gọi service → dịch entity → response.

**Tại sao phải mỏng:** Controller chỉ là **một** cửa vào. Logic đặt ở đây sẽ không dùng lại được từ queue/cron, và khó test (phải dựng HTTP). Không try/catch, không tự log — `HttpLoggingInterceptor` đã ghi access log `[HTTP]`.

```ts
// src/modules/provider/presentation/provider.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProviderService } from '@modules/provider/application/provider.service';
import { CreateProviderRequest } from '@modules/provider/presentation/dto/create-provider.request';
import { ProviderResponse } from '@modules/provider/presentation/dto/provider.response';

@Controller('providers')
export class ProviderController {
    constructor(private readonly providerService: ProviderService) {}

    @Post()
    async create(@Body() body: CreateProviderRequest): Promise<ProviderResponse> {
        const provider = await this.providerService.create({ code: body.code, name: body.name, baseUrl: body.baseUrl });
        return ProviderResponse.from(provider);
    }

    @Get(':id')
    async getById(@Param('id') id: string): Promise<ProviderResponse> {
        return ProviderResponse.from(await this.providerService.getById(id));
    }

    @Post(':id/deactivate')
    async deactivate(@Param('id') id: string): Promise<ProviderResponse> {
        return ProviderResponse.from(await this.providerService.deactivate(id));
    }
}
```

---

## 6. `provider.module.ts` — Nơi Cắm Adapter Vào Port ★

**Là gì:** "Bảng mạch" của module: khai báo port nào dùng adapter nào.

**Tại sao quan trọng:** Đây là **file duy nhất** biết cả lõi lẫn adapter. Muốn đổi Postgres sang database khác, hay thay HTTP check bằng bản giả khi chạy local → chỉ sửa `useClass` ở đây.

```ts
// src/modules/provider/provider.module.ts
import { Module } from '@nestjs/common';
import { ProviderService } from '@modules/provider/application/provider.service';
import { ProviderConnectionPort } from '@modules/provider/application/provider-connection.port';
import { ProviderRepositoryPort } from '@modules/provider/domain/provider.repository.port';
import { ProviderRepository } from '@modules/provider/infrastructure/provider.repository';
import { HttpProviderConnectionAdapter } from '@modules/provider/infrastructure/http-provider-connection.adapter';
import { ProviderController } from '@modules/provider/presentation/provider.controller';

@Module({
    controllers: [ProviderController],
    providers: [
        ProviderService,
        { provide: ProviderRepositoryPort, useClass: ProviderRepository },
        { provide: ProviderConnectionPort, useClass: HttpProviderConnectionAdapter },
    ],
    exports: [ProviderService],
})
export class ProviderModule {}
```

- Port là abstract class → dùng **chính nó** làm token, không cần chuỗi `'IProviderRepository'`.
- `DrizzleModule`, `LoggerModule` là `@Global()` → không cần import.
- Chỉ `exports` service. Module khác không bao giờ được chạm vào repository hay adapter của module này.

---

## 7. Luồng Một Request Đi Qua Các File

`POST /providers/0192.../deactivate`:

```
1. provider.controller.ts        nhận id từ URL
2. provider.service.ts           deactivate(id)
3.   └─ ProviderRepositoryPort   findById(id)
4.        └─ provider.repository.ts   SELECT ... → row
5.             └─ provider.mapper.ts  toDomain(row) → ProviderEntity (instance thật)
6. provider.entity.ts            deactivate() — kiểm tra luật, đổi status, ghi event
7. provider.service.ts           save(provider) → mapper.toPersistence → UPSERT
8.                               pullEvents() → phát event
9.                               log [APP][Provider][ProviderService] Provider deactivated
10. provider.response.ts         ProviderResponse.from(entity)
11. controller trả JSON          interceptor log [HTTP][ProviderController] POST ... 201
```

Nếu provider đã inactive: bước 6 ném `ProviderAlreadyInactiveError` → service dịch thành `ConflictException` → client nhận **409**.

---

## 8. Khi Nào Được Bỏ Bớt File

Không phải module nào cũng cần đủ bộ. Bắt đầu tối thiểu, **thêm file khi có lý do**:

| Tình huống | Bộ file |
|---|---|
| CRUD thuần, không có luật nghiệp vụ (danh mục, cấu hình) | entity, errors, repository.port, service, commands, schema, mapper, repository, controller, request/response, module |
| Có field với luật định dạng riêng | \+ `*.vo.ts` |
| Use case gọi hệ thống ngoài | \+ `*.port.ts` ở application + adapter ở infrastructure |
| Module khác cần phản ứng khi module này thay đổi | \+ `*.events.ts` |

Dấu hiệu cần **tách file / thêm file**:
- Service > ~300 dòng → tách theo nhóm use case (`provider-query.service.ts`, `provider-command.service.ts`).
- Cùng một đoạn validate xuất hiện ≥ 2 lần → đó là một value object.
- Service import bất cứ thứ gì từ `infrastructure/` → thiếu port.

---

## 9. Đối Chiếu Với Source Hiện Tại

Template trên là **đích hướng tới**. Source hiện tại (`src/common/base/*`, module `user`) dùng một phiên bản đơn giản hoá:

| Template | Source hiện tại | Hệ quả |
|---|---|---|
| Entity có hành vi, constructor private, `create()` / `restore()` | Entity chỉ là khai báo field (`UserEntity extends BaseEntity`) | Luật nghiệp vụ phải đặt ở hàm policy thuần hoặc service |
| Repository port (abstract class) ở `domain/` | Không có port; service inject class `BaseRepository` cụ thể qua token chuỗi `'IUserRepository'` | Application phụ thuộc vào infrastructure, test service phải mock class Drizzle |
| Mapper row ⇄ entity | Không có; `BaseRepository` ép kiểu row thành entity (`as T`) | Row DB lọt thẳng vào lõi, entity không có method |
| Command riêng cho use case | Service nhận `Partial<T>`, controller nhận `any` | Client gửi field nào lưu field đó |
| Response DTO | `BaseController` trả nguyên row DB | Có thể lộ field nhạy cảm |

**Có thể áp dụng template ngay cho module mới** — template không phụ thuộc vào `BaseService` / `BaseRepository` / `BaseController`, chỉ dùng chung `baseSchema`, `DRIZZLE` và `LoggerPort`. Module cũ chuyển dần khi có dịp chỉnh sửa.
