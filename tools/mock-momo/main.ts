import { createMockMomo } from './mock-momo';

const env = process.env;
const port = Number(env.MOCK_MOMO_PORT ?? 4030);
const partnerCode = env.MOCK_MOMO_PARTNER_CODE ?? 'PHUONGQUAN';
const username = env.MOCK_MOMO_USERNAME ?? 'pq_partner';
const password = env.MOCK_MOMO_PASSWORD ?? 'pq_pass_2026';
const secretKey = env.MOCK_MOMO_SECRET_KEY ?? 'momo_sk_demo_7d41';
const tokenTtlSec = Number(env.MOCK_MOMO_TOKEN_TTL_SEC ?? 600);
const delaySec = Number(env.MOCK_MOMO_DELAY_SEC ?? 15);

const mock = createMockMomo({
  partnerCode,
  username,
  password,
  secretKey,
  tokenTtlMs: tokenTtlSec * 1000,
  delayMs: delaySec * 1000,
  log: (line) =>
    console.log(`[MoMo giả ${new Date().toLocaleTimeString('vi-VN')}] ${line}`),
});

void mock.listen(port).then((actualPort) => {
  console.log(`
MoMo TELCO B2B giả (dạng tài liệu Ver1.0.2) đang chạy.

Thông tin để tích hợp trên giao diện (loại "Tự cấu hình", nạp tools/integrations/momo.json):
  Mã nhà cung cấp   MOMO
  Địa chỉ API       http://localhost:${actualPort}
  Biến              partnerCode = ${partnerCode}, username = ${username}, env = uat
  Bí mật            password = ${password}
                    secretKey = ${secretKey}
Token sống ${tokenTtlSec} giây. Cho token hết hạn ngay: curl -X POST http://localhost:${actualPort}/_mock/expire-tokens

Gói (productId): 1N_TMDT, MD18, V90C. PRODUCT_INACTIVE_TEST → 862500001. Mã khác → 862200001.
Đơn ở trạng thái Pending, sau ${delaySec} giây có kết quả (không có callback, Hub tự tra cứu).
Số điện thoại thử (thao tác Mua gói data):
  số bất kỳ 0xxxxxxxxx   thành công
  ...0002                bị từ chối ngay: 862500005 Subscriber not match provider
  ...0005                thất bại khi tra cứu (status FAILED)
  ...0007                tạo đơn trả 862000009 Processing, sau đó thành công
  ...0008                MoMo nhận đơn nhưng trả HTTP 504 (Hub phải tra cứu mới biết)

Xem đơn MoMo giả đang giữ: http://localhost:${actualPort}/_mock/orders
`);
});

const shutdown = () => void mock.close().then(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
