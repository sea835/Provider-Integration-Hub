import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { HttpJsonClient } from '@modules/provider-adapter/infrastructure/http/http-json.client';

async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

describe('HttpJsonClient', () => {
  const client = new HttpJsonClient();

  it('cổng không có dịch vụ: báo rõ máy chủ từ chối kết nối thay vì "fetch failed"', async () => {
    const port = await closedPort();
    const res = await client.request({
      method: 'GET',
      url: `http://127.0.0.1:${port}/ping`,
      timeoutMs: 2000,
    });
    expect(res).toMatchObject({
      ok: false,
      kind: 'NETWORK',
      message: `Không kết nối được tới 127.0.0.1:${port}: máy chủ từ chối kết nối (sai cổng hoặc dịch vụ chưa chạy) [ECONNREFUSED]`,
    });
  });

  it('tên miền không tồn tại: báo không tìm thấy tên miền', async () => {
    const res = await client.request({
      method: 'GET',
      url: 'http://khong-ton-tai.invalid/ping',
      timeoutMs: 5000,
    });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.message).toMatch(
      /khong-ton-tai\.invalid: .*\[(ENOTFOUND|EAI_AGAIN)\]/,
    );
  });

  it('quá thời gian: TIMEOUT kèm số mili giây đã chờ', async () => {
    const server = createServer(() => undefined);
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = server.address() as AddressInfo;
    const res = await client.request({
      method: 'GET',
      url: `http://127.0.0.1:${port}/slow`,
      timeoutMs: 150,
    });
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(res).toMatchObject({
      ok: false,
      kind: 'TIMEOUT',
      message: 'Hết thời gian chờ 150 ms',
    });
  });
});
