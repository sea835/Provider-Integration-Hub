import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import { AddressInfo } from 'node:net';

/**
 * MoMo TELCO B2B giả theo tài liệu [MOMO] B2B Ver1.0.2: đăng nhập lấy token, header partnerCode/time/requestId (UUID),
 * Bearer token, chữ ký HMAC-SHA256 trên body chưa có trường signature, mã lỗi 86xxxxxxx, không có callback.
 * Kiểm tra độc lập với engine của Hub để thử tích hợp "Tự cấu hình".
 */
export interface MockMomoOptions {
  partnerCode: string;
  username: string;
  password: string;
  secretKey: string;
  tokenTtlMs: number;
  delayMs: number;
  log?: (line: string) => void;
}

interface MomoOrder {
  momoTransId: string;
  partnerTransId: string;
  phone: string;
  productId: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
}

export interface MockMomo {
  readonly orders: Map<string, MomoOrder>;
  readonly requests: string[];
  readonly logins: number;
  expireTokens(): void;
  listen(port: number): Promise<number>;
  close(): Promise<void>;
}

const PRODUCTS: Record<string, { amount: number; active: boolean }> = {
  '1N_TMDT': { amount: 10000, active: true },
  MD18: { amount: 18000, active: true },
  V90C: { amount: 85000, active: true },
  PRODUCT_INACTIVE_TEST: { amount: 50000, active: false },
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME_SKEW_MS = 5 * 60_000;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function reply(
  res: ServerResponse,
  status: number,
  error: number,
  message: string,
  extra: Record<string, unknown> = { data: null },
) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error, message, time: Date.now(), ...extra }));
}

function header(req: IncomingMessage, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function sameHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createMockMomo(options: MockMomoOptions): MockMomo {
  const orders = new Map<string, MomoOrder>();
  const requests: string[] = [];
  const tokens = new Map<string, number>();
  const seenRequestIds = new Set<string>();
  const timers = new Set<NodeJS.Timeout>();
  const log = options.log ?? (() => undefined);
  let seq = 0;
  let logins = 0;
  let balance = 5_000_000;
  let pending = 0;

  function later(ms: number, fn: () => void) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  }

  function view(order: MomoOrder, forStatus: boolean) {
    const base = {
      momoTransId: order.momoTransId,
      partnerTransId: order.partnerTransId,
      productId: order.productId,
      amount: order.amount,
    };
    return forStatus
      ? {
          ...base,
          phoneNumber: order.phone,
          status: order.status === 'PENDING' ? 'Pending' : order.status,
        }
      : { ...base, phone: order.phone };
  }

  /** Kiểm tra chung mọi request: header bắt buộc, requestId UUID không trùng, thời gian hợp lệ. */
  function checkCommon(req: IncomingMessage, res: ServerResponse): boolean {
    if (header(req, 'partnerCode') !== options.partnerCode) {
      reply(res, 200, 862200004, 'PartnerCode not found');
      return false;
    }
    const requestId = header(req, 'requestId');
    if (!UUID.test(requestId)) {
      reply(res, 400, 866300024, 'requestId must be a UUID');
      return false;
    }
    if (seenRequestIds.has(requestId)) {
      reply(res, 200, 862400002, 'Duplicate request');
      return false;
    }
    seenRequestIds.add(requestId);
    const time = Number(header(req, 'time'));
    if (!Number.isFinite(time) || Math.abs(Date.now() - time) > TIME_SKEW_MS) {
      reply(res, 200, 862400003, 'Invalid request timestamp');
      return false;
    }
    return true;
  }

  function checkToken(req: IncomingMessage, res: ServerResponse): boolean {
    const auth = header(req, 'Authorization');
    if (!auth.startsWith('Bearer ')) {
      reply(res, 401, 862100005, 'Missing authorization header');
      return false;
    }
    const expiresAt = tokens.get(auth.slice(7));
    if (expiresAt === undefined) {
      reply(res, 401, 866300002, 'Invalid Token');
      return false;
    }
    if (expiresAt <= Date.now()) {
      reply(res, 401, 866300020, 'Token Expired');
      return false;
    }
    return true;
  }

  function finish(order: MomoOrder) {
    const failed = order.phone.endsWith('0005');
    order.status = failed ? 'FAILED' : 'SUCCESS';
    pending -= order.amount;
    if (failed) balance += order.amount;
    log(`đơn ${order.partnerTransId} → ${order.status}`);
  }

  function login(rawBody: string, res: ServerResponse) {
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      reply(res, 200, 866100020, 'Missing Request Body', {
        accessToken: null,
      });
      return;
    }
    if (!input.username) {
      reply(res, 200, 866100021, 'Username Required', { accessToken: null });
      return;
    }
    if (!input.password) {
      reply(res, 200, 866100022, 'Password Required', { accessToken: null });
      return;
    }
    if (
      input.username !== options.username ||
      input.password !== options.password
    ) {
      log('login → 866300001 sai tài khoản');
      reply(res, 200, 866300001, 'Unauthorized', { accessToken: null });
      return;
    }
    logins += 1;
    const token = randomBytes(24).toString('base64url');
    tokens.set(token, Date.now() + options.tokenTtlMs);
    log(`login → token mới (lần ${logins})`);
    reply(res, 200, 866000000, 'Success', { accessToken: token });
  }

  function create(rawBody: string, res: ServerResponse) {
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      reply(res, 200, 862100006, 'Invalid JSON format');
      return;
    }
    const { signature, ...unsigned } = input;
    const expected = createHmac('sha256', options.secretKey)
      .update(JSON.stringify(unsigned))
      .digest('hex');
    if (typeof signature !== 'string' || !sameHex(signature, expected)) {
      log('create → 866300022 sai chữ ký');
      reply(res, 200, 866300022, 'Signature Invalid');
      return;
    }
    const text = (value: unknown) =>
      typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '';
    const partnerTransId = text(unsigned.partnerTransId);
    const phone = text(unsigned.phone);
    const productId = text(unsigned.productId);
    if (!partnerTransId || partnerTransId.length > 50) {
      reply(res, 200, 862100007, 'Invalid partner transaction ID');
      return;
    }
    const existing = orders.get(partnerTransId);
    if (existing) {
      log(`create ${partnerTransId} → 862600001 trùng, trả đơn cũ`);
      reply(res, 200, 862600001, 'Duplicate transaction ID', {
        data: view(existing, false),
      });
      return;
    }
    if (!/^0\d{9}$/.test(phone)) {
      reply(res, 200, 862100001, 'Invalid phone number format');
      return;
    }
    const product = PRODUCTS[productId];
    if (!product) {
      reply(res, 200, 862200001, 'Product not found');
      return;
    }
    if (!product.active) {
      reply(res, 200, 862500001, 'Product not active');
      return;
    }
    if (phone.endsWith('0002')) {
      log(`create ${partnerTransId} → 862500005 thuê bao không đúng nhà mạng`);
      reply(res, 200, 862500005, 'Subscriber not match provider');
      return;
    }
    seq += 1;
    const order: MomoOrder = {
      momoTransId: `O${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(seq).padStart(4, '0')}`,
      partnerTransId,
      phone,
      productId,
      amount: product.amount,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    orders.set(partnerTransId, order);
    balance -= order.amount;
    pending += order.amount;
    later(options.delayMs, () => finish(order));

    if (phone.endsWith('0008')) {
      log(`create ${partnerTransId} → đã nhận đơn nhưng trả 504`);
      res.writeHead(504, { 'Content-Type': 'text/plain' });
      res.end('Gateway Timeout');
      return;
    }
    const processing = phone.endsWith('0007');
    log(
      `create ${partnerTransId} ${productId} ${phone} → ${processing ? '862000009' : '862000000'}`,
    );
    reply(
      res,
      200,
      processing ? 862000009 : 862000000,
      processing ? 'Processing' : 'Success',
      { data: view(order, false) },
    );
  }

  function status(url: URL, res: ServerResponse) {
    const partnerTransId = url.searchParams.get('partnerTransId') ?? '';
    const momoTransId = url.searchParams.get('momoTransId');
    if (!partnerTransId) {
      reply(res, 200, 862200008, 'Missing query parameters');
      return;
    }
    const order = orders.get(partnerTransId);
    if (!order || (momoTransId && momoTransId !== order.momoTransId)) {
      log(`status ${partnerTransId} → 862200003 không có đơn`);
      reply(res, 200, 862200003, 'Transaction not found');
      return;
    }
    log(`status ${partnerTransId} → ${order.status}`);
    reply(res, 200, 862000000, 'Success', { data: view(order, true) });
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const rawBody = await readBody(req);
    const url = new URL(req.url ?? '/', 'http://mock-momo.local');
    requests.push(`${req.method} ${url.pathname}${url.search}`);

    if (req.method === 'GET' && url.pathname === '/_mock/orders') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([...orders.values()], null, 2));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/_mock/expire-tokens') {
      tokens.forEach((_, token) => tokens.set(token, 0));
      log('đã cho mọi token hết hạn');
      reply(res, 200, 0, 'OK');
      return;
    }
    if (!checkCommon(req, res)) return;

    if (req.method === 'POST' && url.pathname === '/telco/partner/login') {
      login(rawBody, res);
      return;
    }
    if (!checkToken(req, res)) return;

    if (req.method === 'POST' && url.pathname === '/telco/v1/orders/create') {
      create(rawBody, res);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/telco/v1/orders/status') {
      status(url, res);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/telco/v1/products') {
      const phone = url.searchParams.get('phone');
      if (phone && !/^0\d{9}$/.test(phone)) {
        reply(res, 200, 862100003, 'Invalid phone number format');
        return;
      }
      reply(res, 200, 862000000, 'Success', {
        data: Object.entries(PRODUCTS)
          .filter(([, product]) => product.active)
          .map(([productId]) => ({
            productId,
            provider: 'Viettel',
            category: 'topupData',
            status: 1,
          })),
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/telco/v1/partner/balance') {
      reply(res, 200, 862000000, 'Success', {
        data: { availBalance: balance, pendBalance: pending, currency: 'VND' },
      });
      return;
    }
    reply(res, 404, 862001006, `Not found: ${req.method} ${url.pathname}`);
  }

  const server: Server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) reply(res, 500, 862001006, 'System Error');
    });
  });

  return {
    orders,
    requests,
    get logins() {
      return logins;
    },
    expireTokens: () => tokens.forEach((_, token) => tokens.set(token, 0)),
    listen: (port) =>
      new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () =>
          resolve((server.address() as AddressInfo).port),
        );
      }),
    close: () =>
      new Promise((resolve) => {
        timers.forEach((timer) => clearTimeout(timer));
        timers.clear();
        server.close(() => resolve());
      }),
  };
}
