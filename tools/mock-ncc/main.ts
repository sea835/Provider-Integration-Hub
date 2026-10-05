import { createMockNcc } from './mock-ncc';

const env = process.env;
const port = Number(env.MOCK_NCC_PORT ?? 4010);
const prefix = env.MOCK_NCC_PREFIX ?? '/hub/v1';
const keyId = env.MOCK_NCC_KEY_ID ?? 'hub-sandbox';
const secret = env.MOCK_NCC_SECRET ?? 'sk_sandbox_9f2c4e7a';
const callbackUrl =
  env.MOCK_NCC_CALLBACK_URL ?? 'http://localhost:3000/v1/callbacks/NCC_DEMO';
const callbackSecret = env.MOCK_NCC_CALLBACK_SECRET ?? 'cb_sandbox_51d0a8e3';
const delaySec = Number(env.MOCK_NCC_DELAY_SEC ?? 20);

const mock = createMockNcc({
  keyId,
  secret,
  prefix,
  callbackUrl,
  callbackSecret,
  delayMs: delaySec * 1000,
  callbackRetryDelaysMs: [5_000, 15_000, 30_000],
  log: (line) =>
    console.log(`[NCC giả ${new Date().toLocaleTimeString('vi-VN')}] ${line}`),
});

void mock.listen(port).then((actualPort) => {
  const baseUrl = `http://localhost:${actualPort}${prefix}`;
  console.log(`
NCC giả theo Quy chuẩn API nhà cung cấp v1 đang chạy.

Nhập vào Hub (loại "Chuẩn Hub v1"):
  Base URL              ${baseUrl}
  Key ID                ${keyId}
  Secret ký request     ${secret}
  Secret kiểm callback  ${callbackSecret}

Callback gửi về       ${callbackUrl}
Đơn "đang xử lý" có kết quả sau ${delaySec} giây.

Số thuê bao thử:
  0900000001  thành công ngay
  0900000002  thất bại ngay (SUBSCRIBER_INVALID)
  0900000003  đang xử lý, sau ${delaySec} giây thành công + callback
  0900000004  đang xử lý, sau ${delaySec} giây thất bại (OUT_OF_STOCK) + callback
  0900000005  trả lỗi 500 nhưng đơn vẫn được tạo (Hub phải tự tra cứu ra kết quả)
  số khác     đang xử lý, sau ${delaySec} giây thành công + callback
  packageCode NOT_EXIST  thất bại ngay (PACKAGE_NOT_FOUND)

API không bắt buộc (danh sách gói, kiểm tra gói, danh sách đơn):
  Gói: DATA5GB (mua data), TOPUP50 (nạp tiền), ESIM5GB (kích hoạt SIM)
  Kiểm tra gói: 0900000006 hoặc packageCode NOT_EXIST → không đăng ký được
  Bật "Kiểm tra gói trước khi gửi đơn" thì các đơn đó thất bại ngay, không gửi

Xem đơn NCC giả đang giữ: http://localhost:${actualPort}/_mock/orders
`);
});

const shutdown = () => void mock.close().then(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
