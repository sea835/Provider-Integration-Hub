# 📋 CHECKLIST REVIEW & TEST TÍCH HỢP ANI SIM (CHUẨN TEMPLATE ADAPTER)

> **Mục tiêu:** Tài liệu hướng dẫn chi tiết các bước review mã nguồn và quy trình kiểm thử (Manual Test + Automated Test) cho luồng tích hợp nhà cung cấp **ANI SIM** trên hệ thống **Provider Integration Hub**.

---

## I. CODE REVIEW CHECKLIST (KIỂM TRA KIẾN TRÚC MÃ NGUỒN)

| Tiêu chí | File liên quan | Điểm cần kiểm tra | Trạng thái |
|---|---|---|:---:|
| **Hexagonal Structure** | `src/modules/{catalog, transaction, provider-adapter}` | Tách bạch rõ 4 tầng: `domain` (thuần nghiệp vụ) ➔ `application` (use cases) ➔ `infrastructure` (Drizzle, HTTP) ➔ `presentation` (Controllers, DTOs). Mũi tên phụ thuộc chỉ đi vào trong. | ✅ Đạt |
| **Adapter Interface Contract** | [provider-adapter.port.ts](file:///Users/haingo/PhuongQuan/Provider%20Integration%20Hub/src/modules/provider-adapter/domain/provider-adapter.port.ts) | Định nghĩa đầy đủ `ProviderAdapterPort` (tương đương `IProviderAdapter` mục 4.1): `checkEligibility`, `createOrder`, `queryOrderStatus`, `parseWebhookCallback`. | ✅ Đạt |
| **ANI SIM Custom Adapter** | [anisim.adapter.ts](file:///Users/haingo/PhuongQuan/Provider%20Integration%20Hub/src/modules/provider-adapter/infrastructure/adapters/anisim.adapter.ts) | - Xác thực qua header `X-API-Key`.<br>- Bước 2 tự kiểm tra điều kiện (gói hoạt động, phôi SIM hợp lệ).<br>- Bước 3 gọi `POST /api/v1/agency/orders` map trạng thái `1` ➔ `PROCESSING`.<br>- Bước 4A parse Webhook `ORDER_RESULT` trích xuất `lpaString`, `qrUrl`, `serial`, `msisdn`.<br>- Bước 4B gọi polling `GET /api/v1/agency/orders?keyword={requestId}`. | ✅ Đạt |
| **Dynamic Adapter Registry** | [provider-adapter.registry.ts](file:///Users/haingo/PhuongQuan/Provider%20Integration%20Hub/src/modules/provider-adapter/application/provider-adapter.registry.ts) | Cho phép Core Engine định tuyến Adapter động bằng `providerCode` (`'ANISIM'`), sẵn sàng cắm thêm adapter khác mà không sửa Core. | ✅ Đạt |
| **Idempotency & SSoT** | [transaction.service.ts](file:///Users/haingo/PhuongQuan/Provider%20Integration%20Hub/src/modules/transaction/application/transaction.service.ts) | - Chống nạp đúp bằng `partnerTransId` (`requestId`). Nếu trùng `requestId` thì trả lại kết quả giao dịch cũ ngay, không gọi NCC lần 2.<br>- Lưu trữ trạng thái bền vững trong PostgreSQL `transactions`. | ✅ Đạt |
| **Type Safety & Lint** | Toàn bộ các module mới | Tuân thủ TypeScript strict mode, không dùng `any` không an toàn, đạt chuẩn ESLint và Prettier của dự án. | ✅ Đạt |

---

## II. CHUẨN BỊ MÔI TRƯỜNG TRƯỚC KHI TEST

### 1. Cấu hình file `.env`
Đảm bảo file `.env` đã có các biến cấu hình cần thiết từ `.env.example`:
```dotenv
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/provider_hub?schema=public

# Cấu hình đối tác ANI SIM
ANISIM_BASE_URL=https://ap1.anipay.vn
ANISIM_API_KEY=YOUR_ANI_SIM_API_KEY_HERE
```

### 2. Đồng bộ Database Schema
Chạy lệnh đẩy cấu trúc bảng `transactions` mới vào PostgreSQL:
```bash
npm run db:push
```

### 3. Khởi động ứng dụng
```bash
npm run start:dev
```
Server chạy mặc định tại: `http://localhost:3000`

---

## III. KỊCH BẢN KIỂM THỬ TỪNG BƯỚC (END-TO-END TEST SCENARIOS)

---

### Kịch bản 1: Lấy danh mục gói cước khả dụng (Bước 1 - Sync < 5ms)
* **Mục tiêu:** Client tra cứu danh mục gói cước có sẵn trong hệ thống (gồm gói mẫu `SM110` của ANI SIM).
* **Request:**
```bash
curl -X GET "http://localhost:3000/engine/v1/packages" \
  -H "Content-Type: application/json"
```
* **Kỳ vọng Response (HTTP 200):**
```json
{
  "code": 0,
  "message": "Success",
  "data": [
    {
      "sku": "SM110",
      "name": "Gói cước SM110 (7GB/ngày)",
      "telco": "VINAPHONE",
      "price": 110000,
      "costPrice": 95000,
      "cycleDays": 30,
      "dataGbPerDay": 7,
      "canActivate": true,
      "canTopup": true,
      "status": "ACTIVE",
      "providerCode": "ANISIM",
      "supplierPackageId": "87196a70-196c-48cc-9a00-02a8667d9bba"
    }
  ]
}
```

---

### Kịch bản 2: Kiểm tra điều kiện gói cước với thuê bao (Bước 2 - Sync < 1s)
* **Mục tiêu:** Kiểm tra thuê bao và gói cước có đủ điều kiện kích hoạt hay không.

#### Case 2.1: Gói cước hợp lệ
```bash
curl -X POST "http://localhost:3000/engine/v1/check" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0914780285",
    "packageCode": "SM110"
  }'
```
* **Kỳ vọng Response (HTTP 200):**
```json
{
  "code": 0,
  "message": "Success",
  "data": {
    "eligible": true,
    "reason": null
  }
}
```

#### Case 2.2: Gói cước không tồn tại
```bash
curl -X POST "http://localhost:3000/engine/v1/check" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0914780285",
    "packageCode": "UNKNOWN_PACKAGE"
  }'
```
* **Kỳ vọng Response (HTTP 200):**
```json
{
  "code": 0,
  "message": "Success",
  "data": {
    "eligible": false,
    "reason": "Package UNKNOWN_PACKAGE not found in catalog"
  }
}
```

---

### Kịch bản 3: Tiếp nhận và tạo đơn hàng kích hoạt (Bước 3 - Async Mode 2)
* **Mục tiêu:** Tạo đơn hàng kích hoạt SIM/eSIM mới. Core Engine tiếp nhận nhanh, sinh `transCode`, lưu trạng thái `PROCESSING` và gọi ANI SIM.
* **Request:**
```bash
curl -X POST "http://localhost:3000/engine/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST_ANI_ORDER_001",
    "action": "ACTIVATE_SIM",
    "phone": "0914780285",
    "packageCode": "SM110",
    "serial": "8984012601500769003"
  }'
```
* **Kỳ vọng Response (HTTP 201 Created):**
```json
{
  "code": 0,
  "message": "Order accepted",
  "data": {
    "transCode": "TX_20260928_XXXXX",
    "requestId": "TEST_ANI_ORDER_001",
    "supplierTransId": "ord_...",
    "providerCode": "ANISIM",
    "packageCode": "SM110",
    "action": "ACTIVATE_SIM",
    "status": "PROCESSING",
    "phone": "0914780285",
    "serial": "8984012601500769003",
    "amount": 110000,
    "costAmount": 95000,
    "lpaString": null,
    "qrUrl": null,
    "errorCode": null,
    "errorMessage": null
  }
}
```
*(Ghi nhớ giá trị `transCode` trả về để kiểm tra các bước sau).*

---

### Kịch bản 4: Kiểm tra chống nạp đúp (Idempotency Key)
* **Mục tiêu:** Gửi lại y hệt request của Kịch bản 3 với cùng `requestId: "TEST_ANI_ORDER_001"`.
* **Request:**
```bash
curl -X POST "http://localhost:3000/engine/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST_ANI_ORDER_001",
    "action": "ACTIVATE_SIM",
    "phone": "0914780285",
    "packageCode": "SM110"
  }'
```
* **Kỳ vọng Response:** Trả về ngay thông tin của đơn hàng đã tạo trước đó, **không sinh thêm bản ghi mới trong DB và không gọi sang NCC lần thứ 2**.

---

### Kịch bản 5: Tra cứu trạng thái đơn hàng (Bước 4 - Sync < 5ms)
* **Mục tiêu:** Client/Store chủ động tra cứu trạng thái đơn hàng theo mã nội bộ `transCode`.
* **Request:** Thay `<TRANS_CODE>` bằng mã thực tế từ Kịch bản 3:
```bash
curl -X GET "http://localhost:3000/engine/v1/orders/<TRANS_CODE>" \
  -H "Content-Type: application/json"
```
* **Kỳ vọng Response (HTTP 200):**
```json
{
  "code": 0,
  "message": "Success",
  "data": {
    "transCode": "<TRANS_CODE>",
    "requestId": "TEST_ANI_ORDER_001",
    "status": "PROCESSING",
    "packageCode": "SM110"
  }
}
```

---

### Kịch bản 6: Tiếp nhận Webhook Callback từ ANI SIM (Bước 4A)
* **Mục tiêu:** Giả lập ANI SIM gửi Webhook thông báo đơn kích hoạt eSIM đã hoàn tất (`status: 4`), kèm mã LPA và link QR.
* **Request:**
```bash
curl -X POST "http://localhost:3000/api/v1/callback/orders" \
  -H "Content-Type: application/json" \
  -H "X-MK-Callback-Event: ORDER_RESULT" \
  -d '{
    "code": 0,
    "data": {
      "id": "ord_ani_sample_12345",
      "requestId": "TEST_ANI_ORDER_001",
      "status": 4,
      "msisdn": "0914780285",
      "serial": "8984012601500769003",
      "lpa": "LPA:1$smdp.anipay.vn$MATCHING_ID_009988",
      "urlLpa": "https://ap1.anipay.vn/qr/esim_009988.png",
      "costPrice": 95000
    }
  }'
```
* **Kỳ vọng Response (HTTP 200):**
```json
{
  "code": 0,
  "message": "Received"
}
```

---

### Kịch bản 7: Xác nhận đơn hàng sau Webhook (Trạng thái COMPLETED + eSIM LPA/QR)
* **Mục tiêu:** Tra cứu lại đơn hàng để xác nhận trạng thái đã được cập nhật thành công từ Webhook.
* **Request:**
```bash
curl -X GET "http://localhost:3000/engine/v1/orders/<TRANS_CODE>" \
  -H "Content-Type: application/json"
```
* **Kỳ vọng Response (HTTP 200):**
```json
{
  "code": 0,
  "message": "Success",
  "data": {
    "transCode": "<TRANS_CODE>",
    "requestId": "TEST_ANI_ORDER_001",
    "status": "COMPLETED",
    "lpaString": "LPA:1$smdp.anipay.vn$MATCHING_ID_009988",
    "qrUrl": "https://ap1.anipay.vn/qr/esim_009988.png",
    "phone": "0914780285",
    "serial": "8984012601500769003",
    "costAmount": 95000,
    "completedAt": "2026-09-28T..."
  }
}
```
*(Đơn hàng đã được chốt `COMPLETED`, có đầy đủ chuỗi kích hoạt eSIM `lpaString` và `qrUrl`).*

---

### Kịch bản 8: Polling thủ công kiểm tra trạng thái (Bước 4B - Fallback)
* **Mục tiêu:** Thăm dò trạng thái trực tiếp với NCC khi chưa nhận được Webhook.
* **Request:**
```bash
curl -X POST "http://localhost:3000/engine/v1/orders/<TRANS_CODE>/poll" \
  -H "Content-Type: application/json"
```
* **Kỳ vọng Response (HTTP 200):** Trả về trạng thái mới nhất đồng bộ trực tiếp từ API của ANI SIM.

---

## IV. KIỂM TRA DỮ LIỆU TRONG POSTGRESQL

Kiểm tra trực tiếp trong PostgreSQL để xác nhận tính toàn vẹn dữ liệu:
```sql
SELECT trans_code, partner_trans_id, supplier_trans_id, provider_code, package_code, status, lpa_string, qr_url, completed_at
FROM transactions
WHERE partner_trans_id = 'TEST_ANI_ORDER_001';
```
* **Kỳ vọng:**
  - `status`: `'COMPLETED'`
  - `supplier_trans_id`: Lưu đúng mã ID đơn hàng NCC trả về.
  - `lpa_string` và `qr_url`: Được điền đầy đủ từ Webhook.

---

## V. KIỂM THỬ TỰ ĐỘNG (AUTOMATED TESTS)

Chạy bộ test suite tự động kiểm tra logic adapter và service:
```bash
# 1. Chạy Unit test cho AnisimAdapter và TransactionService
npm test -- anisim.adapter.spec.ts transaction.service.spec.ts

# 2. Chạy toàn bộ test suite của toàn dự án
npm test

# 3. Kiểm tra ESLint code style
npx eslint "src/modules/{catalog,transaction,provider-adapter}/**/*.ts"
```
* **Kết quả kỳ vọng:**
  - Unit test: **100% Passed** (7/7 tests).
  - Toàn dự án: **60/60 tests Passed**.
  - ESLint: **0 errors, 0 warnings**.
