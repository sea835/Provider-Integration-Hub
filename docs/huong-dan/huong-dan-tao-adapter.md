# Hướng Dẫn Tạo Adapter Nhà Cung Cấp

Adapter nối Core với API của một nhà cung cấp (NCC). Core lo hàng đợi, poll, gửi lại và trạng thái đơn; adapter chỉ gọi API của NCC và quy phản hồi về 5 outcome.

> **Trước khi viết code:** NCC có API JSON thông thường thì tích hợp bằng loại **Tự cấu hình** ngay trên giao diện (tab Tích hợp), không cần viết adapter. Ví dụ ANI SIM được tích hợp hoàn toàn bằng cấu hình `tools/integrations/anisim.json`. Chỉ viết adapter code khi NCC cần thứ giao diện không làm được: ký hoặc mã hoá RSA/AES, SOAP/XML, luồng nhiều bước.

Ví dụ dùng NCC giả định **EXAMPLE**. Copy về, đổi `EXAMPLE` / `Example` / `example` thành tên NCC, rồi sửa các chỗ ghi ở mục "Đổi gì". Adapter thật để tham khảo: `src/modules/provider-adapter/infrastructure/adapters/hub-standard/`.

---

## Quy tắc phải nhớ

**Không chắc thì trả `UNKNOWN`. Chỉ trả `FAILED` khi NCC nói rõ đơn không được làm.** FAILED làm Store hoàn tiền cho người mua; nếu NCC thực ra đã làm đơn thì công ty mất tiền.

| Outcome | Khi nào | Core làm gì |
|---|---|---|
| `SUCCESS` | NCC xác nhận xong | Đơn COMPLETED |
| `FAILED` | NCC từ chối rõ ràng | Đơn FAILED |
| `PENDING` | NCC đang xử lý | Hẹn tra cứu lại |
| `UNKNOWN` | Timeout, 5xx, mã lạ, mã đơn trùng | Hẹn tra cứu lại; quá `maxWaitSec` thì MANUAL_REVIEW |
| `NOT_FOUND` | Tra cứu: NCC không có đơn này | Gửi lại cùng mã, tối đa `maxResubmit` lần |

- Gửi `cmd.transCode` làm mã đơn sang NCC. Core gửi lại cùng mã khi NCC báo không thấy đơn.
- Không throw, không tự retry, không sleep trong adapter.
- Gọi HTTP qua `HttpJsonClient` với `ctx.timeouts`; dựng trace bằng `traceOf()` để che secret.
- Lỗi khi tra cứu luôn là `UNKNOWN`. API tra cứu trả danh sách thì lọc đúng phần tử có mã bằng `transCode`.

---

## Bước 1. Lập bảng phân loại

Đọc tài liệu NCC, ghi mỗi kiểu phản hồi thành một dòng. Bước 3 code theo bảng này, bước 5 test theo bảng này.

| Phản hồi (ví dụ) | Khi gửi đơn | Khi tra cứu |
|---|---|---|
| 200, `code 00`, `status SUCCESS` | SUCCESS | SUCCESS |
| 200, `code 00`, `status PROCESSING` | PENDING | PENDING |
| 200, `code 00`, `status FAILED` | FAILED | FAILED |
| `code 14`, `21` (sai gói, sai thuê bao) | FAILED | UNKNOWN |
| 401, 403 (sai API key) | FAILED | UNKNOWN |
| `code 44` (không có đơn) | UNKNOWN | NOT_FOUND |
| 5xx, mã lạ, timeout, lỗi mạng | UNKNOWN | UNKNOWN |

Hỏi NCC trước khi code: gửi lại cùng mã đơn có tạo đơn mới không? Tra cứu theo mã của mình được không? Có callback không, gửi từ IP nào?

## Bước 2. Cấu hình

Tạo thư mục `src/modules/provider-adapter/infrastructure/adapters/example/`.

`example.config.ts`: secrets được mã hoá và không bao giờ trả ra API; params là thông số không bí mật, không cần thì để class rỗng.

```ts
import { IsNotEmpty, IsString } from 'class-validator';

export class ExampleParams {}

export class ExampleSecrets {
  @IsString()
  @IsNotEmpty()
  apiKey: string;
}
```

## Bước 3. Mapper

`example.mapper.ts`: biến phản hồi của NCC thành outcome, đúng như bảng ở bước 1.

```ts
import { Outcome, SUPPLIER_CONFIG_ERROR, SupplierResult, SupplierTrace, unknownResult } from '@modules/provider-adapter/domain/supplier-result';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';

export interface ExampleBody {
  code?: string;
  message?: string;
  transId?: string;
  status?: string;
}

const OK_CODE = '00';
const REJECT_CODES = ['14', '21'];
const NOT_FOUND_CODE = '44';

export function toExampleResult(res: HttpResult, trace: SupplierTrace, isQuery: boolean): SupplierResult {
  if (!res.ok) {
    const code = res.kind === 'TIMEOUT' ? 'SUPPLIER_TIMEOUT' : 'SUPPLIER_UNREACHABLE';
    return unknownResult(res.message, trace, code);
  }

  const body = (res.body ?? {}) as ExampleBody;
  const message = body.message ?? `HTTP ${res.status}`;

  if (res.status < 300 && body.code === OK_CODE) return fromExampleStatus(body, trace);
  if (isQuery) {
    return body.code === NOT_FOUND_CODE
      ? { outcome: Outcome.NOT_FOUND, trace }
      : unknownResult(message, trace, `EXAMPLE_QUERY_${body.code ?? res.status}`);
  }
  if (res.status === 401 || res.status === 403) return failed(SUPPLIER_CONFIG_ERROR, message, trace);
  if (body.code && REJECT_CODES.includes(body.code)) return failed(`EXAMPLE_${body.code}`, message, trace);
  return unknownResult(message, trace, `EXAMPLE_${body.code ?? res.status}`);
}

export function fromExampleStatus(body: ExampleBody, trace: SupplierTrace): SupplierResult {
  const base = { supplierTransId: body.transId, trace };
  switch (body.status) {
    case 'SUCCESS':
      return { ...base, outcome: Outcome.SUCCESS };
    case 'PROCESSING':
      return { ...base, outcome: Outcome.PENDING };
    case 'FAILED':
      return { ...failed('EXAMPLE_FAILED', body.message ?? 'EXAMPLE báo thất bại', trace), ...base };
    default:
      return unknownResult(`Trạng thái EXAMPLE lạ: ${String(body.status)}`, trace, 'EXAMPLE_UNKNOWN_STATUS');
  }
}

function failed(code: string, message: string, trace: SupplierTrace): SupplierResult {
  return { outcome: Outcome.FAILED, error: { code, message }, trace };
}
```

**Đổi gì:** tên trường trong `ExampleBody`; `OK_CODE`, `REJECT_CODES`, `NOT_FOUND_CODE`; các `case` trạng thái. Mã chưa rõ nghĩa thì đừng cho vào `REJECT_CODES`, để nó rơi xuống `UNKNOWN`.

## Bước 4. Adapter

`example.adapter.ts`: dựng request, gọi NCC, đưa kết quả cho mapper.

```ts
import { Injectable } from '@nestjs/common';
import { OrderAction } from '@modules/provider-adapter/domain/order-action';
import { ConnectionTestResult, OrderCommand, OrderRef, ProviderAdapter, SupplierContext } from '@modules/provider-adapter/domain/provider-adapter.port';
import { SupplierResult } from '@modules/provider-adapter/domain/supplier-result';
import { HttpJsonClient, HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { asText, traceOf } from '@modules/provider-adapter/infrastructure/http/trace';
import { ExampleParams, ExampleSecrets } from '@modules/provider-adapter/infrastructure/adapters/example/example.config';
import { toExampleResult } from '@modules/provider-adapter/infrastructure/adapters/example/example.mapper';

@Injectable()
export class ExampleAdapter implements ProviderAdapter {
  readonly type = 'EXAMPLE';
  readonly meta = {
    label: 'Example',
    description: 'Mua gói data qua API của Example',
    editor: 'FIELDS' as const,
    params: [],
    secrets: [{ key: 'apiKey', label: 'API key', required: true }],
  };
  readonly capabilities = { actions: [OrderAction.BUY_DATA], callback: false };
  readonly paramsClass = ExampleParams;
  readonly secretsClass = ExampleSecrets;

  constructor(private readonly http: HttpJsonClient) {}

  async submit(ctx: SupplierContext, cmd: OrderCommand): Promise<SupplierResult> {
    const body = { requestId: cmd.transCode, packageCode: cmd.packageCode, msisdn: cmd.phone };
    const res = await this.call(ctx, 'POST', '/orders', ctx.timeouts.submitMs, body);
    return toExampleResult(res, traceOf(body, res), false);
  }

  async query(ctx: SupplierContext, ref: OrderRef): Promise<SupplierResult> {
    const res = await this.call(ctx, 'GET', `/orders/${encodeURIComponent(ref.transCode)}`, ctx.timeouts.queryMs);
    return toExampleResult(res, traceOf({ requestId: ref.transCode }, res), true);
  }

  async testConnection(ctx: SupplierContext): Promise<ConnectionTestResult> {
    const res = await this.call(ctx, 'GET', '/packages?limit=1', ctx.timeouts.queryMs);
    if (!res.ok) return { ok: false, latencyMs: res.durationMs, message: res.message };
    return { ok: res.status < 300, latencyMs: res.durationMs, message: `HTTP ${res.status}` };
  }

  private call(ctx: SupplierContext, method: 'GET' | 'POST', path: string, timeoutMs: number, body?: unknown): Promise<HttpResult> {
    return this.http.request({
      method,
      url: `${ctx.baseUrl}${path}`,
      headers: { Authorization: `Bearer ${asText(ctx.secrets.apiKey)}` },
      body,
      timeoutMs,
    });
  }
}
```

**Đổi gì:** `type` (tên admin chọn khi tạo NCC); `meta` (tên hiển thị và các ô giao diện sẽ hiện cho params/secrets); `actions` (`BUY_DATA`, `TOPUP`, `ACTIVATE_SIM`); đường dẫn, body, header xác thực theo tài liệu NCC. `testConnection` chỉ gọi API chỉ đọc, không tạo đơn.

## Bước 5. Đăng ký và test

Thêm adapter vào `src/modules/provider-adapter/provider-adapter.module.ts`. Đây là file duy nhất ngoài thư mục `example/` phải sửa.

```ts
ExampleAdapter,
{
  provide: PROVIDER_ADAPTERS,
  useFactory: (standard: HubStandardAdapter, config: HttpConfigAdapter, example: ExampleAdapter) => [
    standard,
    config,
    example,
  ],
  inject: [HubStandardAdapter, HttpConfigAdapter, ExampleAdapter],
},
```

`example.mapper.spec.ts`: mỗi dòng của bảng ở bước 1 là một dòng test.

```ts
import { toExampleResult } from '@modules/provider-adapter/infrastructure/adapters/example/example.mapper';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { OutcomeType } from '@modules/provider-adapter/domain/supplier-result';

const trace = { durationMs: 1 };
const http = (status: number, body: unknown): HttpResult => ({ ok: true, status, body, rawText: JSON.stringify(body), durationMs: 1 });
const timeout: HttpResult = { ok: false, kind: 'TIMEOUT', message: 'timeout', durationMs: 1 };

describe('EXAMPLE mapper', () => {
  it.each<[string, HttpResult, boolean, OutcomeType]>([
    ['gửi: thành công', http(200, { code: '00', status: 'SUCCESS' }), false, 'SUCCESS'],
    ['gửi: NCC từ chối', http(400, { code: '14' }), false, 'FAILED'],
    ['gửi: sai API key', http(401, {}), false, 'FAILED'],
    ['gửi: timeout', timeout, false, 'UNKNOWN'],
    ['tra cứu: không có đơn', http(404, { code: '44' }), true, 'NOT_FOUND'],
    ['tra cứu: sai API key', http(401, {}), true, 'UNKNOWN'],
  ])('%s', (_name, res, isQuery, outcome) => {
    expect(toExampleResult(res, trace, isQuery).outcome).toBe(outcome);
  });
});
```

```bash
npx eslint --fix src/modules/provider-adapter/infrastructure/adapters/example
npx jest adapters/example
```

## Bước 6. Chạy thử trên sandbox

Không cần deploy lại để đổi cấu hình, mọi thứ làm qua API admin:

1. `POST /admin/suppliers` với `"adapterType": "EXAMPLE"`, `baseUrl`, `secrets`. NCC mới luôn ở trạng thái PAUSED.
2. `POST /admin/suppliers/{id}/test-connection` phải ra `"ok": true`.
3. `PATCH /admin/suppliers/{id}` với `{"status": "ACTIVE"}`.
4. Đặt một đơn `POST /v1/orders` với `"supplierCode": "EXAMPLE"`, rồi xem `GET /admin/orders/{transCode}/events`: request và response đúng tài liệu NCC, không lộ API key.

---

## NCC có callback

1. Đặt `callback: true` trong `capabilities`.
2. Thêm `parseCallback` vào adapter, trả `eventId`, `transCode` và `result` (dùng lại `fromExampleStatus`). `eventId` phải giữ nguyên khi NCC gửi lại cùng một sự kiện. Mẫu: `parseCallback` trong `hub-standard.adapter.ts`.
3. Đăng ký với NCC URL `https://DOMAIN/v1/callbacks/EXAMPLE`, đưa IP của NCC vào `callbackIpWhitelist` qua `PATCH /admin/suppliers/{id}`.

## Checklist trước khi tạo PR

- [ ] Test đủ: thành công, đang xử lý, bị từ chối, sai API key, 5xx, timeout, tra cứu không thấy đơn.
- [ ] Lỗi khi tra cứu không bao giờ ra `FAILED`.
- [ ] Gửi `transCode` làm mã đơn sang NCC.
- [ ] Adapter không throw, không tự retry, không sleep.
- [ ] Dùng `ctx.timeouts` và `traceOf()`; events không lộ API key.
- [ ] `test-connection` ra `"ok": true` và một đơn sandbox chạy đúng.
