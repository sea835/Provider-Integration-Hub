# Hướng Dẫn Logging Theo Tag

Tài liệu quy ước viết log dạng tag `[...]` trong dự án **Provider Integration Hub**, theo kiến trúc **DDD Hexagonal**.

---

## 1. Định Dạng Log

Mỗi dòng log gồm: thời gian, level, request id (nếu có), chuỗi tag và nội dung.

```
2026-09-24 10:15:02.481 INFO    [req:0192f3a1] [APP][User][UserService] User created {"userId":"0192f3a1-..."}
└──────── thời gian ──┘ └level┘ └─ request ─┘ └──────── tag ─────────┘ └ message ┘ └──── meta ────┘
```

Ở môi trường production (`LOG_FORMAT=json`), cùng dòng log trên được in ra dạng JSON để đẩy vào ELK / Loki:

```json
{"time":"2026-09-24T10:15:02.481Z","level":"info","tags":["APP","User","UserService"],"requestId":"0192f3a1","msg":"User created","meta":{"userId":"0192f3a1-..."}}
```

---

## 2. Quy Ước Tag

### Cấu trúc: `[LAYER][BoundedContext][Component]`

| Vị trí | Ý nghĩa | Ví dụ |
|---|---|---|
| 1. `LAYER` | Layer theo Hexagonal (bắt buộc, lấy từ `LogLayer`) | `APP`, `INFRA`, `HTTP`, `SYS` |
| 2. `BoundedContext` | Tên module / bounded context, viết PascalCase | `User`, `Provider`, `Payment` |
| 3. `Component` | Tên class, luôn dùng `ClassName.name` (không gõ tay chuỗi) | `UserService`, `UserRepository` |

Có thể thêm tag thứ 4 khi một component có nhiều luồng con rõ rệt, ví dụ `[INFRA][Provider][VnpayClient][Webhook]`. Không vượt quá 4 tag.

### Bảng Layer

| Tag | Hằng số | Dùng ở | Ví dụ |
|---|---|---|---|
| `[APP]` | `LogLayer.APPLICATION` | `modules/*/application` — service, use case | `[APP][User][UserService]` |
| `[INFRA]` | `LogLayer.INFRASTRUCTURE` | `modules/*/infrastructure`, `../../src/infrastructure` — repository, client gọi provider ngoài, queue | `[INFRA][Provider][VnpayClient]` |
| `[HTTP]` | `LogLayer.PRESENTATION` | Access log tự động của `HttpLoggingInterceptor` | `[HTTP][UserController]` |
| `[SYS]` | `LogLayer.SYSTEM` | Log nội bộ của NestJS (bootstrap, route mapping, exception handler) — tự động | `[SYS][RoutesResolver]` |

> **Domain layer không log.** Code trong `modules/*/domain` phải thuần, không phụ thuộc vào logger. Domain trả kết quả, ném domain error hoặc phát domain event; việc ghi log thuộc về application layer.

> `[HTTP]` và `[SYS]` được sinh tự động, controller thông thường **không cần** tự log.

---

## 3. Cách Sử Dụng

### Bước 1: Inject `LoggerPort` và gắn tag trong constructor

Luôn inject qua `LoggerPort` (port ở `@common/logger`), **không** import trực tiếp `TaggedLoggerAdapter` hay `loggerRegistry` trong code nghiệp vụ.

```ts
import { LoggerPort, LogLayer } from '@common/logger';

@Injectable()
export class UserService extends BaseService<UserEntity> {
    private readonly logger: LoggerPort;

    constructor(
        @Inject('IUserRepository') private readonly userRepository: UserRepository,
        logger: LoggerPort,
    ) {
        super(userRepository);
        this.logger = logger.child(LogLayer.APPLICATION, 'User', UserService.name);
    }
}
```

Ở infrastructure, đổi layer thành `LogLayer.INFRASTRUCTURE`:

```ts
this.logger = logger.child(LogLayer.INFRASTRUCTURE, 'Provider', VnpayClient.name);
```

### Bước 2: Ghi log

```ts
this.logger.info('User created', { userId: user.id });
this.logger.warn('Provider responded slowly', { provider: 'vnpay', durationMs: 4200 });
this.logger.error('Sync provider failed', err, { providerId });
this.logger.debug('Request payload built', { payload });
```

- `error(message, error?, meta?)` — tham số thứ 2 là **object lỗi** (để in stack), meta là tham số thứ 3.
- Các level còn lại: `(message, meta?)`.

### Về instance logger

`child()` **không tạo instance mới** mỗi lần gọi. Mọi logger được lưu trong registry global (`../../src/infrastructure/logger/logger.registry.ts`), mỗi bộ tag chỉ có đúng 1 instance cho toàn app:

```ts
logger.child('APP', 'User', 'UserService') === logger.child('APP').child('User').child('UserService'); // true
```

---

## 4. Chọn Log Level

| Level | Khi nào dùng | Ví dụ |
|---|---|---|
| `error` | Lỗi cần người xử lý: nghiệp vụ thất bại, provider lỗi sau khi đã retry hết | `Sync provider failed` |
| `warn` | Bất thường nhưng hệ thống vẫn chạy được: retry, fallback, provider chậm, dữ liệu lạ | `Retry calling provider (2/3)` |
| `info` | Sự kiện nghiệp vụ quan trọng, mỗi request chỉ nên có vài dòng | `User created`, `Payment confirmed` |
| `debug` | Chi tiết phục vụ debug: payload, bước xử lý trung gian | `Request payload built` |
| `verbose` | Rất chi tiết, chỉ bật khi điều tra sự cố cụ thể | Raw response từ provider |

Mức mặc định là `info` — `debug` và `verbose` sẽ không được in trừ khi đổi `LOG_LEVEL`.

---

## 5. Tag vs Meta — Quy Tắc Quan Trọng

**Tag chỉ chứa định danh tĩnh** (layer, bounded context, tên class). **Mọi dữ liệu động đưa vào `meta`.**

```ts
// ❌ SAI — userId làm tag: mỗi user sinh ra 1 instance mới trong registry → rò rỉ bộ nhớ
this.logger.child('APP', 'User', userId).info('Updated');

// ❌ SAI — nhét dữ liệu vào message: khó lọc, khó query trên ELK/Loki
this.logger.info(`User ${userId} updated email to ${email}`);

// ✅ ĐÚNG — message cố định, dữ liệu ở meta
this.logger.info('User email updated', { userId, email });
```

Message nên là **câu cố định** để có thể tìm kiếm / đếm số lần xuất hiện.

---

## 6. Request ID

- Mỗi HTTP request được gán một `requestId` (lấy từ header `x-request-id` nếu upstream đã gửi, nếu không thì tự sinh UUIDv7) và trả lại trong response header `x-request-id`.
- Mọi log phát sinh trong request đó **tự động** có `[req:xxx]` — không cần truyền tay qua tham số.
- Khi debug một request: lấy `x-request-id` từ response, sau đó lọc log theo giá trị đó.

```bash
grep "req:0192f3a1" app.log
```

---

## 7. Bảo Mật — Dữ Liệu Nhạy Cảm

Các key sau trong `meta` tự động bị thay bằng `[REDACTED]` (không phân biệt hoa thường, kể cả object lồng nhau):

`password`, `token`, `accessToken`, `refreshToken`, `secret`, `authorization`, `apiKey`

Tuy vậy vẫn phải tuân thủ:

- **Không** đưa dữ liệu nhạy cảm vào **message** — redact chỉ áp dụng cho `meta`.
- **Không** log nguyên request body / response của provider ở level `info`. Nếu cần, dùng `debug` và chỉ chọn các field cần thiết.
- Cần redact thêm key mới → bổ sung vào `DEFAULT_REDACT_KEYS` trong `../../src/infrastructure/logger/logger.config.ts`.

---

## 8. Cấu Hình

Khai báo trong `../../.env`:

| Biến | Giá trị | Mặc định |
|---|---|---|
| `LOG_LEVEL` | `error` \| `warn` \| `info` \| `debug` \| `verbose` | `info` |
| `LOG_FORMAT` | `pretty` (dev, có màu) \| `json` (prod) | `json` nếu `NODE_ENV=production`, ngược lại `pretty` |

---

## 9. Checklist Khi Review Code

- [ ] Logger được inject qua `LoggerPort`, không import adapter / registry.
- [ ] Tag đúng thứ tự `[LAYER][BoundedContext][Component]`, layer lấy từ `LogLayer`, component dùng `ClassName.name`.
- [ ] Không có logger trong `domain/`.
- [ ] Tag không chứa giá trị động (id, email, số lượng...).
- [ ] Message là câu cố định, dữ liệu nằm trong `meta`.
- [ ] `error()` truyền object lỗi ở tham số thứ 2.
- [ ] Level phù hợp, không lạm dụng `info` cho log chi tiết.
- [ ] Không có dữ liệu nhạy cảm trong message.
