# Hướng dẫn triển khai Core P1 (từng bước)

Thiết kế gốc: [docs/thiet-ke-core-dieu-phoi-ncc.md](../thiet-ke-core-dieu-phoi-ncc.md). Làm tuần tự từng bước, mỗi bước xong thì gửi review rồi mới sang bước tiếp theo.

## Những điểm khác so với tài liệu thiết kế

Các điểm này được chốt trong lúc lập kế hoạch triển khai. Tài liệu thiết kế sẽ được cập nhật lại theo.

| # | Tài liệu thiết kế | Khi triển khai |
|---|---|---|
| 1 | Hai bảng `suppliers` + `supplier_settings` | **Một bảng `suppliers`**, vì bảng `supplier_settings` cũ không còn |
| 2 | Tiền dùng `numeric(15,2)` | **`bigint({ mode: 'number' })`** đơn vị VND. VND không có phần lẻ, và `numeric` trả về string trong `node-postgres` |
| 3 | Module `order` | Giữ tên module **`transaction`** đang có |
| 4 | Một hàm `applyResult` | **`OrderStateService`** là service duy nhất đổi trạng thái đơn (gồm `markSubmitting`, `applyResult`, `scheduleCheck`, `moveToManualReview`, `resolve`) |
| 5 | `bullmq` + `@nestjs/bullmq` | **Chỉ dùng `bullmq`**, vì worker được tạo động theo từng NCC |
| 6 | Queue `supplier:{code}`, jobId `TX…:submit` | Queue **`supplier-{CODE}`**, jobId dùng dấu **`-`**. BullMQ dùng `:` làm dấu phân cách key trong Redis |
| 7 | Sweeper dùng `pg_try_advisory_lock` | Sweeper dùng **Job Scheduler của BullMQ** (`upsertJobScheduler`), BullMQ đảm bảo mỗi lượt chỉ một worker chạy |
| 8 | Bảng `transaction_step_logs` | Đặt tên **`transaction_events`** |
| 9 | ANI `409/4002` chuyển MANUAL_REVIEW | Trả outcome **`UNKNOWN` + cảnh báo**. Trường hợp này chỉ xảy ra khi có bug, và query theo requestId sẽ tìm ra sự thật |
| 10 | Validate `params`/`secrets` bằng Zod | Dùng **class-validator** (đã có sẵn trong repo, không thêm thư viện) |

## Quy ước chung cho mọi bước

- **Import:** chỉ dùng path alias (`@modules/…`, `@common/…`, `@infrastructure/…`). Không dùng `../`.
- **Tầng domain:** không import Nest hay Drizzle. Lỗi nghiệp vụ là class kế thừa `Error`. Tầng application chuyển lỗi đó thành `HttpException` dạng `{ error: 'ERR_…', message }`. `GlobalExceptionFilter` sẽ trả `error` ra làm mã lỗi, không cần sửa filter.
- **Log:** `logger.child(LogLayer.APPLICATION, '<Context>', <Class>.name)`. Không dùng `new Logger()`.
- **Controller:** gọn. Chỉ một `@ApiOperation` cho mỗi endpoint. Request DTO và response DTO tách riêng, response DTO có `fromEntity`.
- **Cột thời gian:** bảng mới **không** dùng `baseSchema` thì dùng `timestamp(…, { withTimezone: true })`. Bảng dùng `baseSchema` giữ nguyên, sẽ chuyển sang `timestamptz` trong một migration riêng sau P1.
- **Migration:** `npm run db:generate --name=<tên>`, **đọc file SQL**, rồi `npm run db:migrate`. Không sửa hay xoá migration đã chạy.
- **Mỗi bước đều phải qua:** `npm run lint`, `npm test`, và `npx tsc --noEmit` không sinh lỗi mới. Các lỗi sẵn có ở `auth.service.spec.ts`, `user.service.spec.ts`, `test/auth.e2e-spec.ts` thì bỏ qua.

## Quyết định cần chốt trước từng bước

| Câu hỏi | Chốt trước |
|---|---|
| Q2: Ai là bên mua hàng gọi Core (ảnh hưởng cách xác thực) | Bước 4 |
| Q1: Ví nằm ở Core hay WHN | Bước 5 |
| Q3: Hạ tầng có Redis cho BullMQ không | Bước 9 |
| Q4: Store nhận kết quả bằng poll hay webhook | Bước 14 |

## Lộ trình

| Bước | Nội dung | Phụ thuộc |
|---|---|---|
| 0 | Chuẩn bị | — |
| 1 | Supplier: schema + migration | 0 |
| 2 | Supplier: mã hoá secret, repository, service, admin API, cache config | 1 |
| 3 | Catalog: products, supplier_products, chọn tuyến | 2 |
| 4 | Merchant: bảng, API key guard, `GET /v1/products` | 3 |
| 5 | Ví + TransactionRunner | 4 |
| 6 | Transactions + G2 `POST /v1/orders` | 5 |
| 7 | `OrderStateService` + G8 tra cứu + admin resolve | 6 |
| 8 | Contract adapter, registry, `AnisimAdapter` | 7 |
| 9 | BullMQ, `worker.ts`, SubmitProcessor, CheckProcessor | 8 |
| 10 | WorkerManager, Sweeper, pub/sub config | 9 |
| 11 | Callback G6 (ANI) | 10 |
| 12 | G1 `POST /v1/check` | 8 |
| 13 | `SsmediaAdapter` | 12 |
| 14 | Test end-to-end và chuyển dần | 11, 13 |

---

## Bước 0 — Chuẩn bị

1. Tạo nhánh làm việc: `git checkout -b feature/core-p1`.
2. Các thay đổi chưa commit trước đây (AnisimAdapter, catalog, supplier cũ) đã không còn trong working tree. Nếu không cố ý bỏ, kiểm tra Local History của VS Code trước khi bắt đầu.
3. Chạy `npm run db:migrate` trên `main` để chắc DB local khớp với code.

**Xong khi:** đang ở nhánh mới, migrate chạy xong không lỗi.

---

## Bước 1 — Supplier: schema và migration

**Mục tiêu:** DB có bảng `suppliers` và có entity domain tương ứng.

```
src/modules/supplier/
  domain/supplier-status.ts
  domain/supplier.entity.ts
  infrastructure/supplier.schema.ts
```

**Làm:**
1. `supplier-status.ts`: viết theo mẫu `user-role.ts`. Gồm `SupplierStatus` (`ACTIVE`, `PAUSED`, `DISABLED`), `SupplierStatusType`, `SUPPLIER_STATUS_VALUES`.
2. `supplier.entity.ts`: `SupplierEntity extends BaseEntity`, field camelCase khớp với bảng dưới, dùng `declare status: SupplierStatusType`.
3. `supplier.schema.ts`: spread `...baseSchema`, sau đó khai báo:

| Property | Cột | Kiểu | Ràng buộc / mặc định |
|---|---|---|---|
| `status` | `status` | varchar(20) | notNull, default `'PAUSED'` (đè giá trị của baseSchema) |
| `code` | `code` | varchar(50) | notNull, unique |
| `name` | `name` | varchar(255) | notNull |
| `adapterType` | `adapter_type` | varchar(30) | notNull |
| `version` | `version` | integer | notNull, default 1 |
| `baseUrl` | `base_url` | varchar(500) | notNull |
| `submitTimeoutMs` | `submit_timeout_ms` | integer | notNull, default 30000 |
| `checkTimeoutMs` | `check_timeout_ms` | integer | notNull, default 3000 |
| `queryTimeoutMs` | `query_timeout_ms` | integer | notNull, default 10000 |
| `concurrency` | `concurrency` | integer | notNull, default 5 |
| `rateLimitPerMin` | `rate_limit_per_min` | integer | notNull, default 60 |
| `pollScheduleSec` | `poll_schedule_sec` | jsonb, `.$type<number[]>()` | notNull, default `[5,10,20,40,60,120,300,900,1800,3600]` |
| `maxWaitSec` | `max_wait_sec` | integer | notNull, default 86400 |
| `maxResubmit` | `max_resubmit` | integer | notNull, default 2 |
| `callbackIpWhitelist` | `callback_ip_whitelist` | jsonb, `.$type<string[]>()` | notNull, default `[]` |
| `params` | `params` | jsonb, `.$type<Record<string, unknown>>()` | notNull, default `{}` |
| `secretsEnc` | `secrets_enc` | text | nullable |

4. `npm run db:generate --name=add_suppliers`, đọc SQL, rồi `npm run db:migrate`.

**Dễ sai:**
- Phải khai báo `status` **sau** `...baseSchema` thì mới đè được giá trị mặc định.
- `params` là cấu hình adapter đọc lúc chạy. `metadata` (có sẵn từ baseSchema) là ghi chú tự do. Không dùng lẫn.
- `secretsEnc` là `text`, chứa chuỗi đã mã hoá.

**Xong khi:**
- [ ] SQL chỉ có `CREATE TABLE "suppliers"`, có `UNIQUE` cho `code`, `DEFAULT 'PAUSED'`, và các default jsonb ở dạng `'[]'::jsonb` / `'{}'::jsonb`.
- [ ] Insert tay một dòng với `id`, `code`, `name`, `adapter_type`, `base_url`: các cột còn lại nhận default, `status = PAUSED`.

---

## Bước 2 — Supplier: secret, repository, service, admin API, cache config

**Mục tiêu:** Admin tạo và sửa được NCC. Secret được mã hoá trong DB. Có service đọc config lúc chạy.

```
src/common/crypto/secret-cipher.port.ts
src/infrastructure/crypto/aes-gcm-secret-cipher.ts
src/infrastructure/crypto/crypto.module.ts
src/modules/supplier/
  domain/adapter-types.ts
  domain/supplier.repository.port.ts
  domain/supplier-config.ts
  domain/supplier.errors.ts
  infrastructure/supplier.repository.ts
  application/supplier.service.ts
  application/supplier-config.service.ts
  presentation/admin-supplier.controller.ts
  presentation/dto/create-supplier.request.ts
  presentation/dto/update-supplier.request.ts
  presentation/dto/supplier.response.ts
  supplier.module.ts
```

**Làm:**
1. **SecretCipher**
   - Port có 2 hàm: `encrypt(obj): string` và `decrypt(str): obj`.
   - Implement bằng `aes-256-gcm` của `node:crypto`, IV 12 byte ngẫu nhiên mỗi lần mã hoá.
   - Định dạng lưu: `v1.<iv>.<tag>.<ciphertext>`, mỗi phần là base64url.
   - Khoá lấy từ env `APP_ENCRYPTION_KEY` (base64, đúng 32 byte). **Báo lỗi ngay lúc khởi động** nếu thiếu hoặc sai độ dài. Thêm biến này vào `.env.example`.
   - `CryptoModule` đặt `@Global()`.
2. **`adapter-types.ts`:** `ADAPTER_TYPES = ['ANISIM', 'SSMEDIA', 'MOMO']`. Danh sách tạm, Bước 8 sẽ thay bằng registry.
3. **`SupplierConfig`** (kiểu dùng lúc chạy): toàn bộ field của entity, với `secrets` **đã giải mã** thay cho `secretsEnc`.
4. **Repository:** kế thừa `BaseRepository`, thêm `findByCode(code)` và `listAll()`.
5. **`SupplierService`:**
   - `create`: `code` viết hoa. `adapterType` phải thuộc `ADAPTER_TYPES`. Có `secrets` thì mã hoá. Status luôn là `PAUSED`.
   - `update`: không cho sửa `code`. Nếu body có `secrets` thì mã hoá và **thay toàn bộ**, không có thì giữ nguyên. Tăng version bằng SQL: `version = version + 1`, dùng `` sql`${suppliers.version} + 1` ``, **không** đọc lên rồi cộng.
   - **Không có xoá.** Muốn ngừng NCC thì chuyển `DISABLED`, vì đơn hàng tham chiếu tới NCC.
6. **`SupplierConfigService`:**
   - `get(code): Promise<SupplierConfig>`: cache bằng `Map` trong bộ nhớ, TTL 30s, trả secrets đã giải mã.
   - Thêm `invalidate(code)`.
   - **Chỉ** dùng trong worker và adapter, không bao giờ trả ra từ controller.
7. **Controller `/admin/suppliers`:**
   - Endpoints: `GET` (danh sách), `GET :id`, `POST`, `PATCH :id`.
   - `@CheckPolicies((a) => a.can(Action.Manage, SupplierEntity))`.
8. **Validate request:**
   - `baseUrl`: `@IsUrl`.
   - Các timeout: 1000–120000.
   - `concurrency`: 1–50. `rateLimitPerMin`: ≥ 1.
   - `pollScheduleSec`: `@IsArray` + `@IsInt({ each: true })` + `@Min(1, { each: true })` + `@ArrayMinSize(1)`.
   - `callbackIpWhitelist`: `@IsIP(undefined, { each: true })`.
   - `params`, `secrets`: `@IsObject`.
9. **Response:** không có `secretsEnc`. Thay bằng `hasSecrets: boolean`.
10. Đăng ký `SupplierModule` và `CryptoModule` vào `AppModule`.

**Dễ sai:**
- `GlobalExceptionFilter` log `body` khi gặp lỗi 5xx, nên sẽ lộ `secrets`. Sửa filter để che các key `secrets`, `password`, `apiKey` trước khi log.
- Tạo IV mới cho **mỗi** lần mã hoá. Dùng lại IV với GCM là lỗi bảo mật nghiêm trọng.

**Xong khi:**
- [ ] Unit test cipher: mã hoá rồi giải mã ra đúng, sai khoá thì báo lỗi, hai lần mã hoá cùng dữ liệu cho ra chuỗi khác nhau.
- [ ] Unit test service: `update` tăng version, không có `secrets` thì giữ secret cũ.
- [ ] Qua Swagger: tạo NCC ANISIM, `GET` không thấy secret, trong DB `secrets_enc` bắt đầu bằng `v1.`.

---

## Bước 3 — Catalog: products, supplier_products, chọn tuyến

**Mục tiêu:** Có danh mục gói và định tuyến SKU → NCC, cấu hình được lúc runtime.

```
src/modules/catalog/
  domain/order-action.ts
  domain/product-type.ts
  domain/product.entity.ts
  domain/supplier-product.entity.ts
  domain/route.ts
  domain/catalog.errors.ts
  domain/product.repository.port.ts
  domain/supplier-product.repository.port.ts
  domain/route.repository.port.ts
  infrastructure/product.schema.ts
  infrastructure/supplier-product.schema.ts
  infrastructure/*.repository.ts
  application/product.service.ts
  application/supplier-product.service.ts
  application/route-resolver.service.ts
  presentation/admin-product.controller.ts
  presentation/admin-supplier-product.controller.ts
  presentation/dto/*
  catalog.module.ts
```

**Làm:**
1. **Kiểu dữ liệu:**
   - `OrderAction`: `BUY_DATA`, `TOPUP`, `ACTIVATE_SIM`, `CANCEL_PACKAGE`. Đặt ở catalog vì module `transaction` sẽ import từ đây.
   - `ProductType`: `DATA`, `TOPUP`, `SIM`, `ESIM`.
2. **Bảng `products`** (dùng baseSchema, `status` mặc định `'INACTIVE'`):
   - `sku` varchar(100), unique, notNull
   - `name` varchar(255)
   - `type` varchar(20)
   - `telco` varchar(20), nullable
   - `price` bigint number, notNull
   - `actions` jsonb `$type<OrderActionType[]>`, notNull
   - `attrs` jsonb, default `{}`
3. **Bảng `supplier_products`** (dùng baseSchema, `status` mặc định `'INACTIVE'`):
   - `product_id`: FK `products.id`
   - `supplier_id`: FK `suppliers.id`
   - `supplier_product_code` varchar(100), notNull
   - `cost_price` bigint, default 0
   - `priority` int, default 100
   - `params` jsonb, default `{}`
   - `unique().on(productId, supplierId)` và `index().on(productId, status, priority)`
4. **`RouteResolver.resolve(sku, action): Route`:**
   - Một query join `products` + `supplier_products` + `suppliers`.
   - Điều kiện: product ACTIVE, mapping ACTIVE, **supplier ACTIVE**. NCC đang `PAUSED` thì không nhận đơn mới.
   - `order by priority asc limit 1`.
   - `Route` gồm: `productId`, `sku`, `productType`, `price`, `supplierId`, `supplierCode`, `adapterType`, `supplierProductCode`, `costPrice`, `productParams`, `configVersion`.
   - Lỗi domain:
     - Không có tuyến → `ProductUnavailableError`.
     - `action` không thuộc `product.actions` → `ActionNotSupportedError`.
5. **`ProductService.listSellable({ action?, telco? })`:** trả các product có ít nhất một tuyến hợp lệ. Controller cho hàm này làm ở Bước 4.
6. **Admin:** CRUD `/admin/products`, `/admin/supplier-products`. Đổi `priority` hoặc `status` qua `PATCH`.

**Dễ sai:**
- Query join sang bảng `suppliers` là read model, được phép import schema của module supplier trong tầng **infrastructure**. Không import vào domain hay application.
- `price` và `cost_price` là tiền, dùng bigint. Không dùng `numeric`.

**Xong khi:**
- [ ] Unit test `RouteResolver`: chọn đúng `priority` nhỏ nhất; bỏ qua mapping hoặc NCC không ACTIVE; sai action thì báo lỗi.
- [ ] Tạo SKU `SM110` trỏ tới ANISIM qua admin. Đổi `priority` thì tuyến đổi ngay, không cần restart.

---

## Bước 4 — Merchant: API key guard và `GET /v1/products`

**Cần chốt Q2 trước.**

**Mục tiêu:** Store gọi được Core bằng `X-Api-Key`, xem được danh mục gói.

```
src/modules/merchant/
  domain/merchant.entity.ts
  domain/merchant.repository.port.ts
  infrastructure/merchant.schema.ts
  infrastructure/merchant.repository.ts
  application/merchant.service.ts
  presentation/admin-merchant.controller.ts
  presentation/guards/merchant-api-key.guard.ts
  presentation/decorators/merchant-auth.decorator.ts
  presentation/decorators/current-merchant.decorator.ts
  presentation/dto/*
  merchant.module.ts
src/modules/catalog/presentation/product.controller.ts
```

**Làm:**
1. **Bảng `merchants`** (baseSchema):
   - `code` unique
   - `name`
   - `api_key_hash` char(64), unique, notNull
   - `api_key_last4` varchar(4)
   - `ip_whitelist` jsonb `string[]`, default `[]`
2. **Sinh API key:**
   - `pk_` + `randomBytes(32).toString('base64url')`.
   - Lưu `sha256(key)` dạng hex và 4 ký tự cuối.
   - Key gốc **chỉ trả về một lần** khi tạo merchant hoặc gọi `POST /admin/merchants/:id/rotate-key`.
3. **`MerchantApiKeyGuard`:**
   - Đọc header `x-api-key`, hash, tìm merchant.
   - Merchant phải `ACTIVE`, nếu không thì `UnauthorizedException({ error: 'ERR_UNAUTHORIZED' })`.
   - `ip_whitelist` khác rỗng thì `request.ip` phải nằm trong danh sách, nếu không thì `ForbiddenException({ error: 'ERR_FORBIDDEN_IP' })`.
   - Gắn `request.merchant = { id, code }`.
4. **`@MerchantAuth()`:** `applyDecorators(Public(), UseGuards(MerchantApiKeyGuard), SkipThrottle())`.
   - `Public()` để bỏ qua `JwtAuthGuard` toàn cục.
   - `SkipThrottle()` vì throttler toàn cục đang giới hạn **100 request/phút theo IP**, sẽ chặn Store (mọi request đến từ một IP).
   - `@CurrentMerchant()` lấy `request.merchant`.
5. **`GET /v1/products`:** controller trong catalog, gắn `@MerchantAuth()`, gọi `listSellable`.
6. **`main.ts`:** nếu Core chạy sau load balancer hoặc proxy, dùng `NestFactory.create<NestExpressApplication>` và `app.set('trust proxy', 1)`, nếu không `request.ip` sẽ là IP của proxy.

**Dễ sai:**
- So hash để xác thực thì **không** cần `timingSafeEqual`, vì tìm theo hash có index. Nhưng tuyệt đối không log key gốc.
- Không đặt `@Public()` rời lên controller merchant. Luôn đi qua `@MerchantAuth()` để không quên guard.

**Xong khi:**
- [ ] Không có key: 401. Sai IP: 403. Đúng: 200, không cần JWT.
- [ ] Unit test guard cho 4 trường hợp: thiếu key, sai key, merchant không active, sai IP.

---

## Bước 5 — Ví và TransactionRunner

**Cần chốt Q1 trước.** Nếu ví nằm ở WHN thì bỏ bước này, thay bằng một port `WalletPort` gọi sang WHN.

**Mục tiêu:** Trừ và hoàn tiền an toàn, có thể nằm chung một DB transaction với việc tạo đơn.

```
src/common/database/transaction-runner.port.ts
src/infrastructure/database/drizzle-transaction-runner.ts
src/common/base/base.repository.ts                 (sửa)
src/modules/merchant/
  domain/wallet.entity.ts
  domain/wallet-entry.entity.ts
  domain/wallet-entry-type.ts
  domain/wallet.errors.ts
  domain/wallet.repository.port.ts
  infrastructure/wallet.schema.ts
  infrastructure/wallet-entry.schema.ts
  infrastructure/wallet.repository.ts
  application/wallet.service.ts
  presentation/admin-wallet.controller.ts
```

**Làm:**
1. **TransactionRunner:**
   - Port: `run<T>(fn: () => Promise<T>): Promise<T>`.
   - Implement bằng `AsyncLocalStorage`, cùng cách với `request-context.ts`: nếu đang ở trong transaction thì chạy thẳng `fn()`; nếu chưa thì `db.transaction(tx => als.run(tx, fn))`.
2. **`BaseRepository`:** thêm getter `protected get conn()` trả về tx trong ALS nếu có, không thì trả `db`. **Repository mới** dùng `this.conn` thay cho `this.db`. Repository cũ chưa cần sửa.
3. **Bảng `wallets`** (không dùng baseSchema):
   - `merchant_id`: PK, FK
   - `balance` bigint, default 0
   - `credit_limit` bigint, default 0
   - `updated_at` timestamptz
4. **Bảng `wallet_entries`:**
   - `id` uuidv7
   - `merchant_id`
   - `transaction_id` uuid, nullable
   - `type` varchar(20): `DEBIT`, `REFUND`, `TOPUP`, `ADJUST`
   - `amount` bigint **có dấu** (DEBIT âm)
   - `balance_after`
   - `note`, `created_by`, `created_at` timestamptz
   - `uniqueIndex().on(transactionId, type).where(sql\`transaction_id is not null\`)`
5. **`WalletService`** (mọi hàm chạy **bên trong** `TransactionRunner.run`):
   - `debit(merchantId, transactionId, amount)`: khóa ví bằng `select … .for('update')`. Nếu `balance + creditLimit < amount` thì ném `InsufficientBalanceError`. Cập nhật số dư, ghi entry.
   - `refund(merchantId, transactionId, amount)`: khóa ví, `insert … onConflictDoNothing().returning()`. Không insert được nghĩa là đã hoàn rồi, thì dừng. Insert được thì cộng số dư.
   - `topup` / `adjust` cho admin, bắt buộc có `note`.
6. **Tạo ví cùng lúc tạo merchant:** sửa `MerchantService.create` để tạo ví trong cùng `run`.
7. **Admin:** `GET /admin/merchants/:id/wallet`, `POST …/wallet/topup`, `GET …/wallet/entries`.

**Dễ sai:**
- Luôn khóa ví **trước** khi ghi entry để thứ tự khóa nhất quán, tránh deadlock.
- `refund` phải idempotent. Gọi hai lần cho cùng một đơn thì chỉ cộng tiền một lần.

**Xong khi:**
- [ ] Test với DB thật: 2 lần `debit` đồng thời, số dư chỉ đủ cho 1 lần → đúng 1 lần thành công.
- [ ] Gọi `refund` 2 lần → chỉ có 1 entry.
- [ ] SQL đối soát `SUM(amount) = balance` luôn đúng.

---

## Bước 6 — Transactions và G2 `POST /v1/orders`

**Mục tiêu:** Tiếp nhận đơn an toàn: idempotent, trừ tiền, trả về ngay. Chưa đẩy queue thật.

```
src/modules/transaction/
  domain/transaction-status.ts
  domain/transaction.entity.ts                 (viết lại)
  domain/transaction-event.entity.ts
  domain/transaction.errors.ts
  domain/order-queue.port.ts
  domain/transaction.repository.port.ts        (viết lại)
  domain/transaction-event.repository.port.ts
  infrastructure/transaction.schema.ts         (viết lại)
  infrastructure/transaction-event.schema.ts
  infrastructure/transaction.repository.ts
  infrastructure/transaction-event.repository.ts
  infrastructure/noop-order-queue.ts           (tạm, Bước 9 thay)
  application/order.service.ts
  application/phone.ts
  application/request-hash.ts
  presentation/order.controller.ts
  presentation/dto/create-order.request.ts
  presentation/dto/order.response.ts
  transaction.module.ts
```

**Làm:**
1. **`TransactionStatus`:** `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `MANUAL_REVIEW`.
2. **Viết lại bảng `transactions`** (baseSchema, đè `status` thành varchar(30) notNull **không có default**):

| Cột | Kiểu |
|---|---|
| `trans_code` | varchar(40), unique |
| `merchant_id` | FK, notNull |
| `partner_trans_id` | varchar(64), notNull |
| `request_hash` | char(64), notNull |
| `action` | varchar(30) |
| `product_id` | FK |
| `sku` | varchar(100) |
| `supplier_id` | FK, notNull |
| `supplier_product_code` | varchar(100) |
| `product_params` | jsonb |
| `config_version` | int |
| `price`, `cost_price` | bigint |
| `phone` | varchar(15), nullable |
| `serial` | varchar(30), nullable |
| `supplier_trans_id` | varchar(100) |
| `submit_count`, `check_count` | int, default 0 |
| `resubmit_requested` | bool, default false |
| `next_check_at` | timestamptz |
| `delivery` | jsonb, default `{}` |
| `error_code` | varchar(50) |
| `error_message` | text |
| `completed_at` | timestamptz |

   Index: `unique(merchant_id, partner_trans_id)`, `(supplier_id, supplier_trans_id)`, `(status, next_check_at)`.

3. **Bảng `transaction_events`:**
   - `id`, `transaction_id` (FK)
   - `source`: `API`, `SUBMIT`, `CHECK`, `CALLBACK`, `OPERATOR`, `SWEEPER`
   - `type`: `ACCEPTED`, `RESULT`, `STATUS_CHANGED`, `CONFLICT`
   - `outcome`, `from_status`, `to_status`, `config_version`, `http_status`, `duration_ms`
   - `request`, `response` (jsonb)
   - `created_at` timestamptz
4. **Migration:** bảng `transactions` cũ dùng tên cột camelCase.
   - **Kiểm tra bảng đang rỗng ở mọi môi trường.**
   - Khi `drizzle-kit` hỏi cột này có phải đổi tên từ cột kia không, chọn **tạo mới**.
   - Đọc kỹ SQL (sẽ có `DROP COLUMN`).
5. **`OrderQueuePort`:** `enqueueSubmit(transCode, supplierCode, attempt)`. Tạm thời dùng `NoopOrderQueue`, chỉ log.
6. **`phone.ts`:** bỏ ký tự không phải số, `84…` đổi thành `0…`, phải khớp `^0\d{9}$`, không khớp thì báo lỗi validate.
7. **`request-hash.ts`:** sha256 của JSON **đã sắp xếp key** gồm `{ action, sku, phone, serial }`. Không đưa `metadata` vào.
8. **`OrderService.accept(merchant, req)`**, toàn bộ bên trong `TransactionRunner.run`:
   1. Chuẩn hoá phone, tính hash.
   2. Tìm theo `(merchantId, requestId)`:
      - Có và cùng hash: trả `{ created: false, order }`.
      - Có và khác hash: ném `DuplicateRequestIdError`.
   3. `RouteResolver.resolve(sku, action)`.
   4. Validate theo action và loại gói:
      - `BUY_DATA`, `TOPUP` cần `phone`.
      - `ACTIVATE_SIM` với gói loại `SIM` cần `serial`.
      - `CANCEL_PACKAGE` báo `ActionNotSupportedError` (P1 chưa hỗ trợ).
   5. `transCode = uuidv7()`.
   6. `insert … onConflictDoNothing({ target: [merchantId, partnerTransId] }).returning()`. Không có dòng trả về nghĩa là có request trùng chạy song song: đọc lại và xử lý như bước 2.
   7. `WalletService.debit(merchantId, order.id, price)`.
   8. Ghi event `ACCEPTED`.
   9. Ra khỏi transaction thì `enqueueSubmit`, bọc try/catch và chỉ log nếu lỗi.
9. **Controller `POST /v1/orders`:**
   - `@MerchantAuth()`.
   - Đơn mới trả **202**, trùng trả **200**: dùng `@Res({ passthrough: true })` rồi gọi `res.status(...)`.
   - Map lỗi:

| Lỗi | HTTP / `error` |
|---|---|
| `DuplicateRequestIdError` | 409 / `ERR_DUPLICATE_REQUEST_ID` |
| `ProductUnavailableError` | 422 / `ERR_PRODUCT_UNAVAILABLE` |
| `ActionNotSupportedError` | 422 / `ERR_ACTION_NOT_SUPPORTED` |
| `InsufficientBalanceError` | 402 / `ERR_INSUFFICIENT_BALANCE` |
| Lỗi validate | 400 / `ERR_VALIDATION` |

**Dễ sai:**
- Không đủ tiền thì **rollback toàn bộ**, không để lại đơn nào. Store nạp tiền xong có thể gửi lại cùng `requestId`.
- Enqueue phải nằm **sau** commit. Nếu enqueue trong transaction mà transaction rollback, worker sẽ nhận một job trỏ tới đơn không tồn tại.

**Xong khi:**
- [ ] Test e2e (thư mục `test/`, dùng DB test) đủ các ca: đơn mới 202; gửi lại 200 cùng `transCode`; khác payload 409; hết tiền 402 và không có dòng nào; sai SKU 422.
- [ ] Bắn 10 request đồng thời cùng `requestId`: đúng 1 đơn, 1 DEBIT.
- [ ] Ở local, p95 < 100ms.

---

## Bước 7 — OrderStateService, G8 tra cứu, admin resolve

**Mục tiêu:** Có một nơi duy nhất đổi trạng thái đơn, kèm unit test đầy đủ.

```
src/modules/provider-adapter/domain/supplier-result.ts
src/modules/transaction/
  domain/transaction-status.policy.ts
  application/order-state.service.ts
  application/order-query.service.ts
  presentation/order.controller.ts             (thêm GET)
  presentation/admin-order.controller.ts
```

**Làm:**
1. **`supplier-result.ts`:** kiểu `Outcome` và `SupplierResult` (xem thiết kế §5). Tạo sớm vì `OrderStateService` cần. Bước 8 bổ sung phần còn lại của contract.
2. **`transaction-status.policy.ts`** (hàm thuần):
   - `isTerminal(status)`
   - `isConflict(status, outcome)`: `COMPLETED` + `FAILED`, hoặc `FAILED` + `SUCCESS`.
3. **`OrderStateService`**, mỗi hàm là một `TransactionRunner.run` và khóa dòng đơn bằng `.for('update')`:
   - `markSubmitting(transCode): Order | null`
     - Guard: `PENDING`, hoặc `PROCESSING` có `resubmitRequested`. Không thoả trả `null`.
     - Chuyển `PROCESSING`, `submitCount + 1`, `resubmitRequested = false`.
     - Đặt `nextCheckAt = now + submitTimeoutMs + 30s` để Sweeper vớt được nếu worker crash.
   - `applyResult(transCode, result, source)`: theo bảng G7 của thiết kế. `FAILED` gọi `WalletService.refund`. Luôn ghi event. Trạng thái cuối gặp kết quả mâu thuẫn thì ghi event `CONFLICT` và log warn.
   - `scheduleCheck(transCode, delaySec)`: `checkCount + 1` (nếu là CHECK), đặt `nextCheckAt`.
   - `requestResubmit(transCode)`
   - `moveToManualReview(transCode, reason)`
   - `resolve(transCode, outcome, reason, actor)`: chỉ áp dụng cho đơn đang `MANUAL_REVIEW` hoặc `PROCESSING`, `source = OPERATOR`.
4. **G8:**
   - `GET /v1/orders/:transCode` và `GET /v1/orders?requestId=`, đều `@MerchantAuth()`.
   - Chỉ trả đơn của merchant đang gọi. Không phải của mình thì 404 `ERR_ORDER_NOT_FOUND`.
   - `MANUAL_REVIEW` hiển thị ra ngoài là `PROCESSING`.
   - Không trả `supplierTransId` hay tên NCC.
5. **Admin:**
   - `GET /admin/orders?status=`
   - `GET /admin/orders/:transCode/events`
   - `POST /admin/orders/:transCode/resolve { outcome, reason }`

**Dễ sai:**
- `applyResult` **không** tự lên lịch CHECK. Việc đó thuộc processor ở Bước 9. Service này chỉ đổi dữ liệu.
- Mọi thay đổi trạng thái đều phải đi qua service này. Không repository hay processor nào được tự `update status`.

**Xong khi:**
- [ ] Unit test ma trận (trạng thái hiện tại × outcome) có kết quả đúng cho mọi ô.
- [ ] Gặp `FAILED` 2 lần chỉ hoàn tiền 1 lần.
- [ ] `SUCCESS` đến sau `FAILED` tạo event `CONFLICT` và không đổi trạng thái.
- [ ] Admin resolve một đơn `MANUAL_REVIEW` sang `FAILED` thì có hoàn tiền.

---

## Bước 8 — Contract adapter, registry, AnisimAdapter

**Mục tiêu:** Gọi được ANI SIM qua contract chuẩn. Phân loại kết quả có test cho từng ca.

```
src/modules/provider-adapter/
  domain/provider-adapter.port.ts
  application/adapter-registry.ts
  infrastructure/http/http-json.client.ts
  infrastructure/adapters/anisim/anisim.adapter.ts
  infrastructure/adapters/anisim/anisim.mapper.ts
  infrastructure/adapters/anisim/anisim.params.ts
  infrastructure/adapters/anisim/anisim.adapter.spec.ts
  provider-adapter.module.ts
```

**Làm:**
1. **Port:** interface `ProviderAdapter` và các kiểu `SupplierContext`, `OrderCommand`, `EligibilityResult`, `ParsedCallback` (thiết kế §5).
   - Thay `paramsSchema`/`secretsSchema` bằng `paramsClass` và `secretsClass`: các class có decorator class-validator.
2. **`AdapterRegistry`:**
   - Inject tất cả adapter, dựng `Map<type, adapter>`.
   - Hàm `get(type)` và `types()`.
   - Thay `ADAPTER_TYPES` ở Bước 2 bằng `registry.types()`.
   - Trong `SupplierService.create/update`, validate `params` và `secrets` bằng `plainToInstance(adapter.paramsClass, …)` + `validate()`.
3. **`SupplierConfigService.getContext(code)`:** tạo `SupplierContext` từ `SupplierConfig`.
4. **`HttpJsonClient`:**
   - `fetch` + `AbortSignal.timeout(ms)`.
   - **Không throw.** Trả về một trong hai dạng:
     - `{ ok: true, status, body, rawText, durationMs }`
     - `{ ok: false, kind: 'TIMEOUT' | 'NETWORK', durationMs, message }`
   - Body không phải JSON thì `body = null`, vẫn giữ `rawText`.
5. **`AnisimAdapter`:**
   - `capabilities`: `{ actions: ['ACTIVATE_SIM'], check: false, callback: true, balance: false }`.
   - Secrets: `{ apiKey }`. Params: rỗng.
   - **`submit`:** `POST {baseUrl}/api/v1/agency/orders`, body `{ requestId: transCode, packagePlanId: supplierProductCode, serial? }`, header `X-API-Key`.
   - **`query`:** `GET {baseUrl}/api/v1/agency/orders?keyword={transCode}&limit=20`, rồi tìm item có `requestId === transCode`. Không có thì trả `NOT_FOUND`.
   - **`anisim.mapper.ts`** là hàm thuần, dùng chung cho submit, query và callback. Bảng phân loại:

| Phản hồi ANI | Outcome |
|---|---|
| `code 0`, `status` 1–3 | `PENDING` |
| `status 4` | `SUCCESS` |
| `status 5`, `6` | `FAILED` |
| `400/4001`, `404/4000`, `502/6000` | `FAILED` |
| `401/2002`, `403/2001` | `FAILED`, `error.code = SUPPLIER_CONFIG` |
| `409/4002` | `UNKNOWN` + log error |
| `429`, `500`, timeout, lỗi mạng, mã lạ | `UNKNOWN` |

   - **Delivery:** `msisdn`, `serial`. `lpa`/`qrUrl` **chỉ lấy khi** `qrStatus === 2`.
   - `costAmount = Number(totalAmount)`.
   - `supplierTransId = data.id`.
   - **`testConnection`:** `GET /api/v1/agency/package-plans?limit=1`.
6. **Admin:** `POST /admin/suppliers/:id/test-connection`.

**Dễ sai:**
- Tìm theo `keyword` là tìm gần đúng, **bắt buộc** so sánh chính xác `requestId`.
- Đưa vào `trace` thì phải che `X-API-Key` và `lpa`.

**Xong khi:**
- [ ] Spec mock `global.fetch` có đủ mỗi dòng của bảng phân loại.
- [ ] `test-connection` với sandbox ANI trả `ok`.

---

## Bước 9 — BullMQ, worker.ts, SubmitProcessor, CheckProcessor

**Cần chốt Q3 trước.** Cài `bullmq`, thêm `REDIS_URL` vào `.env.example`.

**Mục tiêu:** Đơn tự đi hết vòng đời qua worker.

```
src/infrastructure/queue/redis.provider.ts
src/infrastructure/queue/queue-names.ts
src/infrastructure/queue/bullmq-order-queue.ts
src/infrastructure/queue/queue.module.ts
src/modules/execution/
  application/submit.processor.ts
  application/check.processor.ts
  application/job-dispatcher.ts
  infrastructure/static-worker-bootstrap.ts    (tạm, Bước 10 thay)
  execution.module.ts
src/worker.module.ts
src/worker.ts
```

**Làm:**
1. **Kết nối Redis:** `new IORedis(REDIS_URL, { maxRetriesPerRequest: null })`. BullMQ bắt buộc option này cho worker.
2. **Tên queue và jobId:**
   - Queue: `supplier-${code}`.
   - Job SUBMIT: `${transCode}-submit-${n}`.
   - Job CHECK: `${transCode}-check-${n}`.
   - Option: `attempts: 1`, `removeOnComplete: 1000`, `removeOnFail: 5000`.
3. **`BullmqOrderQueue`:**
   - Implement `OrderQueuePort`, thêm `enqueueCheck(transCode, supplierCode, n, delayMs)`.
   - Cache các instance `Queue` theo từng NCC.
   - Thay `NoopOrderQueue` bằng class này.
4. **`SubmitProcessor.handle(job, token)`:**
   1. `config = SupplierConfigService.get(code)`. Nếu `PAUSED`: `await job.moveToDelayed(Date.now() + 60_000, token)` rồi `throw new DelayedError()`.
   2. `order = markSubmitting(transCode)`. Nếu `null` thì return.
   3. `result = adapter.submit(ctx, cmd)`.
   4. `applyResult(…, 'SUBMIT')`.
   5. Nếu outcome là `PENDING` hoặc `UNKNOWN`: `scheduleCheck` với `pollScheduleSec[0]`, rồi `enqueueCheck`.
5. **`CheckProcessor.handle`:**
   1. Đơn phải đang `PROCESSING`, nếu không thì return.
   2. `adapter.query`, rồi `applyResult(…, 'CHECK')`.
   3. Theo outcome:

| Outcome | Hành động |
|---|---|
| `PENDING` / `UNKNOWN` | Quá `maxWaitSec` tính từ `createdAt` thì `moveToManualReview`. Chưa quá thì `delay = pollScheduleSec[min(checkCount, len - 1)]`, gọi `scheduleCheck` + `enqueueCheck` |
| `NOT_FOUND` | `submitCount <= maxResubmit` thì `requestResubmit` + `enqueueSubmit`. Vượt thì `moveToManualReview` |

6. **`JobDispatcher`:** định tuyến `job.name` sang processor tương ứng.
7. **`StaticWorkerBootstrap` (tạm):** lúc khởi động, tạo một `Worker` cho mỗi NCC `ACTIVE`, dùng `concurrency` và `limiter` từ config. Khi shutdown thì gọi `close()`.
8. **Entrypoint worker:**
   - `worker.ts`: `NestFactory.createApplicationContext(WorkerModule)` + `enableShutdownHooks()`.
   - `WorkerModule` import: `LoggerModule`, `DrizzleModule`, `CryptoModule`, `QueueModule`, `SupplierModule`, `CatalogModule`, `MerchantModule`, `TransactionModule`, `ProviderAdapterModule`, `ExecutionModule`.
   - **`AppModule` không import `ExecutionModule`.**
9. **Script trong `package.json`:**
   - `"start:worker:dev": "nest start --watch --entryFile worker"`
   - `"start:worker": "node dist/worker"`

**Dễ sai:**
- Processor **không throw** với kết quả nghiệp vụ. Chỉ throw khi hỏng hạ tầng (ví dụ DB chết). Job fail thì Sweeper ở Bước 10 sẽ vớt.
- `attempts: 1` là cố ý. Retry do máy trạng thái quyết định, không để BullMQ tự retry.

**Xong khi:**
- [ ] Chạy API + worker. Tạo đơn ANI trên sandbox: đơn đi `PENDING` → `PROCESSING` → các lần CHECK → `COMPLETED`.
- [ ] Tắt worker giữa chừng rồi bật lại: đơn chạy tiếp.
- [ ] Unit test processor với adapter giả cho các ca `SUCCESS`, `UNKNOWN` rồi `SUCCESS`, `NOT_FOUND` rồi gửi lại, và quá `maxWait`.

---

## Bước 10 — WorkerManager, Sweeper, pub/sub config

**Mục tiêu:** Đổi config NCC có hiệu lực không cần restart. Tự phục hồi khi Redis mất job.

```
src/infrastructure/queue/config-events.ts
src/modules/execution/application/worker-manager.ts
src/modules/execution/application/sweeper.processor.ts
```

**Làm:**
1. **`config-events.ts`:**
   - `publish('supplier.changed', { code, version })`.
   - `subscribe(handler)` dùng một kết nối ioredis **riêng** (kết nối đang subscribe không chạy lệnh khác được).
2. **Nối pub/sub:**
   - `SupplierService.update` publish **sau khi** commit.
   - `SupplierConfigService` subscribe để xoá cache.
3. **`WorkerManager`** thay `StaticWorkerBootstrap`:
   - Chạy `reconcile()` khi khởi động, khi nhận event, và mỗi 30s (`setInterval`, clear khi shutdown).
   - Logic như thiết kế §6: `DISABLED` thì đóng worker; version đổi thì tạo lại; `PAUSED` thì `pause()`, còn lại `resume()`.
4. **Sweeper:**
   - Queue `system`, `upsertJobScheduler('sweeper', { every: 60_000 })`.
   - Quét, mỗi lượt tối đa 500 đơn:
     - `PENDING` và `createdAt < now − 30s` → `enqueueSubmit`.
     - `PROCESSING` và `nextCheckAt < now − 60s` → `enqueueCheck`.
   - Ghi event `source = SWEEPER`.

**Dễ sai:**
- Đóng worker (`close()`) sẽ chờ job đang chạy xong. Không dùng `close(true)`, vì force-close giữa chừng khi đang gọi NCC.
- Sweeper chỉ **enqueue**, không tự đổi trạng thái đơn.

**Xong khi:**
- [ ] Đổi `concurrency` qua admin, trong 30s log thấy worker được tạo lại.
- [ ] Chuyển `PAUSED`: job đứng chờ, đơn không FAILED. Chuyển `ACTIVE`: chạy tiếp.
- [ ] Chạy `FLUSHALL` Redis local khi có đơn `PENDING`/`PROCESSING`: trong khoảng 2 phút đơn chạy tiếp.

---

## Bước 11 — Callback G6 (ANI)

**Mục tiêu:** Nhận callback an toàn, chống trùng, cập nhật đơn nhanh hơn poll.

```
src/modules/transaction/
  domain/callback-event.entity.ts
  domain/callback-event.repository.port.ts
  infrastructure/callback-event.schema.ts
  infrastructure/callback-event.repository.ts
  application/callback.service.ts
  presentation/callback.controller.ts
src/modules/provider-adapter/infrastructure/adapters/anisim/anisim.adapter.ts   (thêm parseCallback)
```

**Làm:**
1. **Bảng `callback_events`:**
   - `id`, `supplier_id`, `event_id` varchar(100)
   - `payload` jsonb (đã che dữ liệu nhạy cảm)
   - `matched_tx_id`
   - `received_at` timestamptz
   - `unique(supplier_id, event_id)`
2. **Controller `POST /v1/callbacks/:supplierCode`:**
   - `@Public()`, `@SkipThrottle()`, `@HttpCode(200)`.
   - `@Body() body: unknown`, lấy thêm `@Headers()` và `request.ip`.
3. **`CallbackService.handle`:**
   1. Tìm config NCC. Không tồn tại hoặc `capabilities.callback = false` thì 404.
   2. Xác thực:
      - Adapter có `verifyCallback` thì dùng.
      - Không có thì **`callbackIpWhitelist` phải khác rỗng** và `ip` phải nằm trong danh sách. Không thoả thì 403.
   3. `parsed = adapter.parseCallback(ctx, raw)`.
   4. `insert callback_events … onConflictDoNothing().returning()`. Trùng thì trả `{ code: 0, message: 'Received' }`.
   5. Tìm đơn theo `parsed.transCode`, không có thì theo `(supplierId, supplierTransId)`.
   6. `applyResult(…, 'CALLBACK')`, cập nhật `matched_tx_id`.
4. **ANI `parseCallback`:**
   - `eventId`: lấy `body.eventId`, không có thì header `x-mk-callback-id`.
   - `transCode = body.data.requestId`.
   - Outcome dùng lại `anisim.mapper.ts`.
5. **Callback không khớp đơn nào:** vẫn trả 200 và lưu với `matched_tx_id = null`.

**Dễ sai:**
- Nếu NCC không ký callback mà whitelist rỗng thì phải **từ chối**. Không được hiểu whitelist rỗng là cho tất cả.
- Trả lỗi 5xx khiến ANI retry tới 5 lần. Chỉ trả 5xx khi DB thật sự lỗi.

**Xong khi:**
- [ ] Test: callback trùng `eventId` chỉ xử lý 1 lần; sai IP 403; không khớp đơn vẫn 200; `SUCCESS` đến sau `FAILED` tạo event `CONFLICT`.
- [ ] Dùng tunnel (cloudflared/ngrok) nhận callback thật từ sandbox ANI: đơn `COMPLETED` trước lần CHECK đầu tiên (sau 60s).

---

## Bước 12 — G1 `POST /v1/check`

**Mục tiêu:** Store kiểm tra được điều kiện trước khi đặt đơn.

```
src/modules/catalog/application/eligibility.service.ts
src/modules/catalog/presentation/check.controller.ts
src/modules/catalog/presentation/dto/check.request.ts
src/modules/catalog/presentation/dto/check.response.ts
```

**Làm:**
1. **`EligibilityService.check(req)`:**
   1. `RouteResolver.resolve`. Nếu lỗi thì trả `eligible: false` với `reasonCode` tương ứng.
   2. Validate `phone`/`serial` theo action, giống G2.
   3. Adapter có `checkEligibility` thì gọi với `checkTimeoutMs`.
   4. Timeout hoặc `UNKNOWN`: trả `{ eligible: false, reasonCode: 'ERR_SUPPLIER_TIMEOUT' }`.
2. **Controller:** `@MerchantAuth()`, luôn trả **200**. Kết quả nằm trong body, không dùng HTTP status để báo không đủ điều kiện.

**Dễ sai:**
- G1 **không** thay cho kiểm tra trong G4. SSMedia vẫn check lại trong `submit` khi `precheckOnSubmit`, vì giữa lúc check và lúc đặt đơn có thể có thay đổi.

**Xong khi:**
- [ ] Gói ANI (không có check): đúng action trả `eligible: true`, sai action trả `ERR_ACTION_NOT_SUPPORTED`.

---

## Bước 13 — SsmediaAdapter

**Mục tiêu:** Nạp gói data Vinaphone qua SSMedia.

```
src/modules/provider-adapter/infrastructure/adapters/ssmedia/
  ssmedia.adapter.ts
  ssmedia.crypto.ts
  ssmedia.mapper.ts
  ssmedia.params.ts
  ssmedia.adapter.spec.ts
  ssmedia.crypto.spec.ts
```

**Làm:**
1. **Params:** `{ partnerCode: string, precheckOnSubmit: boolean }` (mặc định `true`).
2. **Secrets:** `{ secretKey: base64 32 byte, privateKeyPem: PKCS#8 PEM }`.
3. **`ssmedia.crypto.ts`:**
   - `encrypt(json)`: `aes-256-ecb`, IV `null`, output base64.
   - `sign(data)`: `crypto.sign('RSA-SHA256', Buffer.from(data), privateKeyPem)`, output base64. **Ký lên chuỗi đã mã hoá.**
4. **Mọi request:** `POST {baseUrl}`, body `{ data, sign, function, partner_code }`.
5. **Các function:**

| Function | Input |
|---|---|
| `check` | `{ time: Date.now(), mobile, package_id: Number(code) }` |
| `topup` | `{ request_id: transCode, package_id: Number(code), mobile }` |
| `get_transaction` | `{ time, request_id }` |
| `topup_account` | `{ time }` |

   `mobile` = phone bỏ số 0 đầu (9 số).

6. **`submit`:**
   1. Nếu `precheckOnSubmit`: gọi `check`. `data.status === "false"` → `FAILED`, `error.code = ERR_NOT_ELIGIBLE`, message lấy `data.error`.
   2. Gọi `topup`.
   3. `supplierTransId = transCode`, `costAmount = data.agent_price`.
7. **`query`:** `get_transaction`, phân loại giống `topup`.
8. **Bảng phân loại (`ssmedia.mapper.ts`):**

| Phản hồi SSMedia | Outcome |
|---|---|
| `status 0` + `data.status "success"` | `SUCCESS` |
| `data.status "check"` | `PENDING` |
| `data.status "error"`, `40`, `41`, `504` | `FAILED` |
| `50`, `52`, `53`, `62`, `500`–`503` | `FAILED`, `error.code = SUPPLIER_CONFIG` |
| `status 1`, `450`, timeout, mã lạ | `UNKNOWN` |

9. **`checkEligibility`** = `check`. **`getBalance`** và **`testConnection`** = `topup_account`.

**Dễ sai:**
- `package_id` phải là **Number**, không phải string.
- **Tài liệu SSMedia không nói `get_transaction` trả gì khi `request_id` không tồn tại.** Phải hỏi SSMedia. Chưa có câu trả lời thì coi là `UNKNOWN`: đơn sẽ đi tới `MANUAL_REVIEW` chứ không tự gửi lại.
- Lỗi `503 invalid Time` nghĩa là đồng hồ server lệch. Server phải bật NTP.

**Xong khi:**
- [ ] Spec crypto: sinh cặp khoá bằng `generateKeyPairSync`, ký xong verify bằng public key; mã hoá rồi giải mã ra đúng JSON.
- [ ] Spec mapper có đủ mỗi dòng của bảng phân loại.
- [ ] `test-connection` với tài khoản test SSMedia trả số dư.

---

## Bước 14 — Test end-to-end và chuyển dần

**Cần chốt Q4 trước.**

**Làm:**
1. **Adapter `FAKE`:** chỉ đăng ký trong môi trường test. Adapter này trả outcome theo kịch bản cấu hình trong `params`, ví dụ `["UNKNOWN", "NOT_FOUND", "SUCCESS"]`.
2. **`test/order.e2e-spec.ts`** chạy trên DB test + Redis test, gồm các kịch bản:
   - Thành công ngay.
   - `PENDING` rồi `SUCCESS`.
   - Timeout, rồi `NOT_FOUND`, gửi lại, `SUCCESS`.
   - `FAILED` → hoàn tiền.
   - Quá `maxWait` → `MANUAL_REVIEW` → admin resolve.
   - Callback trùng.
   - NCC `PAUSED` rồi `ACTIVE`.
   - Flush Redis.
3. **Tải:** k6 hoặc autocannon, `POST /v1/orders` 50 rps trong 2 phút, p95 < 100ms, không có đơn trùng.
4. **SQL đối soát** (chạy hằng ngày):
   - Ví: `SUM(entries) = balance`.
   - Đơn `PROCESSING` quá 1 giờ.
   - Đơn `MANUAL_REVIEW`.
   - Số đơn và tổng tiền theo NCC theo ngày, để so với báo cáo của NCC.
5. **Chuyển dần:**
   - Tạo `products` và `supplier_products` cho các SKU ANI/SSMedia, tạo merchant cho Store.
   - Store gọi Core cho các SKU này, WHN giữ phần còn lại.
   - Chạy song song, đối soát mỗi ngày trong tuần đầu.

**Xong khi:**
- [ ] Toàn bộ kịch bản e2e pass.
- [ ] Một ngày chạy thật không có chênh lệch đối soát.
