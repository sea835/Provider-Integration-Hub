import { createMockAni } from './mock-ani';

const env = process.env;
const port = Number(env.MOCK_ANI_PORT ?? 4020);
const apiKey = env.MOCK_ANI_API_KEY ?? 'ANI_DEMO_KEY';
const callbackUrl =
  env.MOCK_ANI_CALLBACK_URL ?? 'http://localhost:3000/v1/callbacks/ANISIM';
const delaySec = Number(env.MOCK_ANI_DELAY_SEC ?? 15);

const mock = createMockAni({
  apiKey,
  callbackUrl,
  delayMs: delaySec * 1000,
  callbackRetryDelaysMs: [5_000, 15_000, 30_000],
  log: (line) =>
    console.log(`[ANI giả ${new Date().toLocaleTimeString('vi-VN')}] ${line}`),
});

void mock.listen(port).then((actualPort) => {
  console.log(`
ANI SIM giả (dạng API Agency v3.0) đang chạy.

Thông tin để tích hợp trên giao diện (loại "Tự cấu hình"):
  Mã nhà cung cấp   ANISIM   (callback gửi về ${callbackUrl})
  Địa chỉ API       http://localhost:${actualPort}
  Bí mật apiKey     ${apiKey}   (gửi trong header X-API-Key)
  IP callback       127.0.0.1

Gói: plan-esim-5gb (eSIM), plan-sim-10gb (SIM). packagePlanId NOT_EXIST → 404 / 4000.
Đơn ở status 1 (đang xử lý), sau ${delaySec} giây có kết quả và gửi callback.
Serial thử (thao tác Kích hoạt SIM):
  bỏ trống          eSIM, thành công, có LPA và QR
  ...0001 (số khác) SIM vật lý, thành công
  ...0002           bị từ chối ngay: 400 / 4001 Serial is not available
  ...0005           thất bại: status 5, errorCode 4012
  ...0006           bị huỷ: status 6
  ...0009           thành công nhưng KHÔNG gửi callback (Hub phải tự tra cứu)

Xem đơn ANI giả đang giữ: http://localhost:${actualPort}/_mock/orders
`);
});

const shutdown = () => void mock.close().then(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
