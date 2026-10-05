import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import { AddressInfo } from 'node:net';

/**
 * NCC giả làm theo Quy chuẩn API nhà cung cấp v1, để thử Hub mà không cần NCC thật.
 * Tự cài chữ ký riêng (không dùng code của Hub) để bắt được lỗi ký ở cả hai phía.
 */
export interface MockNccOptions {
  keyId: string;
  secret: string;
  prefix: string;
  callbackUrl?: string;
  callbackSecret?: string;
  delayMs: number;
  callbackRetryDelaysMs: number[];
  /** false: NCC không có 3 API không bắt buộc (trả 404 NOT_SUPPORTED). */
  optionalApis?: boolean;
  log?: (line: string) => void;
}

type Status = 'PROCESSING' | 'SUCCESS' | 'FAILED';

interface MockOrder {
  requestId: string;
  orderId: string;
  action: string;
  packageCode: string;
  msisdn: string | null;
  serial: string | null;
  status: Status;
  errorCode: string | null;
  errorMessage: string | null;
  delivery: Record<string, string>;
  createdAt: string;
  completedAt: string | null;
}

interface StoredOrder {
  order: MockOrder;
  fingerprint: string;
}

export interface CallbackAttempt {
  eventId: string;
  requestId: string;
  attempt: number;
  httpStatus: number | null;
}

export interface MockNcc {
  readonly orders: Map<string, MockOrder>;
  readonly callbacks: CallbackAttempt[];
  readonly requests: string[];
  listen(port: number): Promise<number>;
  close(): Promise<void>;
}

const ACTIONS = ['BUY_DATA', 'TOPUP', 'ACTIVATE_SIM'];
const MAX_SKEW_SEC = 300;
const MAGIC = {
  success: '0900000001',
  invalid: '0900000002',
  laterSuccess: '0900000003',
  laterFailed: '0900000004',
  errorButCreated: '0900000005',
  notEligible: '0900000006',
};

const PACKAGES = [
  {
    packageCode: 'DATA5GB',
    name: 'Data 5GB / 30 ngày',
    price: 50000,
    description: 'BUY_DATA',
  },
  {
    packageCode: 'TOPUP50',
    name: 'Nạp 50.000đ',
    price: 50000,
    description: 'TOPUP',
  },
  {
    packageCode: 'ESIM5GB',
    name: 'eSIM 5GB / 30 ngày',
    price: 95000,
    description: 'ACTIVATE_SIM',
  },
];

function hmacHex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function nowIso(): string {
  return new Date().toISOString();
}

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
  code: string,
  message: string,
  data: unknown = null,
  headers: Record<string, string> = {},
): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify({ code, message, data }));
}

export function createMockNcc(options: MockNccOptions): MockNcc {
  const stored = new Map<string, StoredOrder>();
  const orders = new Map<string, MockOrder>();
  const callbacks: CallbackAttempt[] = [];
  const requests: string[] = [];
  const timers = new Set<NodeJS.Timeout>();
  const log = options.log ?? (() => undefined);
  let seq = 0;

  function later(ms: number, fn: () => void): void {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  }

  function header(req: IncomingMessage, name: string): string {
    const value = req.headers[name];
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
  }

  function verify(req: IncomingMessage, rawBody: string): string | null {
    if (header(req, 'x-hub-key-id') !== options.keyId) {
      return 'Sai X-Hub-Key-Id';
    }
    const timestamp = header(req, 'x-hub-timestamp');
    const seconds = Number(timestamp);
    if (!Number.isInteger(seconds)) return 'Thiếu X-Hub-Timestamp';
    if (Math.abs(Date.now() / 1000 - seconds) > MAX_SKEW_SEC) {
      return 'X-Hub-Timestamp lệch quá 300 giây';
    }
    const expected = hmacHex(
      options.secret,
      `${timestamp}\n${req.method ?? ''}\n${req.url ?? ''}\n${rawBody}`,
    );
    return sameText(header(req, 'x-hub-signature'), expected)
      ? null
      : 'Sai chữ ký';
  }

  function finish(
    order: MockOrder,
    status: Exclude<Status, 'PROCESSING'>,
    errorCode: string | null = null,
  ): void {
    order.status = status;
    order.errorCode = errorCode;
    order.errorMessage =
      errorCode === 'SUBSCRIBER_INVALID'
        ? 'Số thuê bao không hợp lệ'
        : errorCode === 'OUT_OF_STOCK'
          ? 'Hết hàng'
          : errorCode === 'PACKAGE_NOT_FOUND'
            ? 'Gói không tồn tại'
            : null;
    order.completedAt = nowIso();
    if (status === 'SUCCESS') order.delivery = deliveryFor(order);
  }

  function deliveryFor(order: MockOrder): Record<string, string> {
    if (order.action !== 'ACTIVATE_SIM') {
      return order.msisdn ? { msisdn: order.msisdn } : {};
    }
    if (order.serial) {
      return { serial: order.serial, msisdn: order.msisdn ?? '0912345678' };
    }
    return {
      lpa: `LPA:1$smdp.mock-ncc.local$${order.orderId}`,
      qrUrl: `https://mock-ncc.local/qr/${order.orderId}`,
    };
  }

  function sendCallback(order: MockOrder, attempt = 1): void {
    if (!options.callbackUrl || !options.callbackSecret) return;
    const eventId = `EV-${order.orderId}-${order.status}`;
    const body = JSON.stringify({ eventId, order });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const record = (httpStatus: number | null) => {
      callbacks.push({
        eventId,
        requestId: order.requestId,
        attempt,
        httpStatus,
      });
      log(
        `callback ${order.requestId} ${order.status} lần ${attempt} → ${httpStatus ?? 'lỗi mạng'}`,
      );
      const ok = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;
      const nextDelay = options.callbackRetryDelaysMs[attempt - 1];
      if (!ok && nextDelay !== undefined) {
        later(nextDelay, () => sendCallback(order, attempt + 1));
      }
    };
    fetch(options.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Supplier-Timestamp': timestamp,
        'X-Supplier-Signature': hmacHex(
          options.callbackSecret,
          `${timestamp}\n${body}`,
        ),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
      .then((res) => record(res.status))
      .catch(() => record(null));
  }

  function createOrder(input: Record<string, unknown>): {
    order: MockOrder;
    failResponse: boolean;
  } {
    const order: MockOrder = {
      requestId: input.requestId as string,
      orderId: `NCC-${String(++seq).padStart(6, '0')}`,
      action: input.action as string,
      packageCode: input.packageCode as string,
      msisdn: (input.msisdn as string | null) ?? null,
      serial: (input.serial as string | null) ?? null,
      status: 'PROCESSING',
      errorCode: null,
      errorMessage: null,
      delivery: {},
      createdAt: nowIso(),
      completedAt: null,
    };
    let failResponse = false;

    if (order.packageCode === 'NOT_EXIST') {
      finish(order, 'FAILED', 'PACKAGE_NOT_FOUND');
    } else if (order.msisdn === MAGIC.success) {
      finish(order, 'SUCCESS');
    } else if (order.msisdn === MAGIC.invalid) {
      finish(order, 'FAILED', 'SUBSCRIBER_INVALID');
    } else if (order.msisdn === MAGIC.errorButCreated) {
      finish(order, 'SUCCESS');
      failResponse = true;
    } else {
      const failLater = order.msisdn === MAGIC.laterFailed;
      later(options.delayMs, () => {
        if (failLater) finish(order, 'FAILED', 'OUT_OF_STOCK');
        else finish(order, 'SUCCESS');
        log(`đơn ${order.requestId} chuyển ${order.status}`);
        sendCallback(order);
      });
    }
    return { order, failResponse };
  }

  function validate(input: Record<string, unknown>): string | null {
    const { requestId, action, packageCode, msisdn, serial } = input;
    if (
      typeof requestId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(requestId)
    ) {
      return 'requestId không hợp lệ';
    }
    if (typeof action !== 'string' || !ACTIONS.includes(action)) {
      return 'action không hợp lệ';
    }
    if (typeof packageCode !== 'string' || packageCode.length === 0) {
      return 'Thiếu packageCode';
    }
    if (msisdn !== null && msisdn !== undefined) {
      if (typeof msisdn !== 'string' || !/^0\d{9}$/.test(msisdn)) {
        return 'msisdn phải là 10 số bắt đầu bằng 0';
      }
    } else if (action !== 'ACTIVATE_SIM') {
      return `msisdn bắt buộc với ${action}`;
    }
    if (serial !== null && serial !== undefined && typeof serial !== 'string') {
      return 'serial không hợp lệ';
    }
    return null;
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const rawBody = await readBody(req);
    const url = req.url ?? '/';
    requests.push(`${req.method} ${url}`);

    if (req.method === 'GET' && url === '/_mock/orders') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([...orders.values()], null, 2));
      return;
    }
    if (!url.startsWith(`${options.prefix}/`)) {
      reply(res, 404, 'NOT_FOUND', `Không có ${url}`);
      return;
    }

    const authError = verify(req, rawBody);
    if (authError) {
      log(`${req.method} ${url} → 401 ${authError}`);
      reply(res, 401, 'UNAUTHORIZED', authError);
      return;
    }

    const fullPath = url.slice(options.prefix.length);
    const [path, search = ''] = fullPath.split('?');
    const params = new URLSearchParams(search);
    const optional =
      (req.method === 'GET' &&
        (path === '/packages' || (path === '/orders' && search))) ||
      (req.method === 'POST' && path === '/packages/check');
    if (optional && options.optionalApis === false) {
      reply(res, 404, 'NOT_SUPPORTED', 'NCC không có API này');
      return;
    }
    if (req.method === 'GET' && path === '/packages') {
      const action = params.get('action');
      const items = PACKAGES.filter(
        (item) => !action || item.description === action,
      );
      log(`GET /packages ${action ?? ''} → ${items.length} gói`);
      reply(res, 200, 'OK', 'ok', { items });
      return;
    }
    if (req.method === 'POST' && path === '/packages/check') {
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        reply(res, 400, 'INVALID_REQUEST', 'Body không phải JSON');
        return;
      }
      const verdict =
        input.packageCode === 'NOT_EXIST'
          ? {
              eligible: false,
              reasonCode: 'PACKAGE_NOT_FOUND',
              reasonMessage: 'Gói không tồn tại',
            }
          : input.msisdn === MAGIC.notEligible
            ? {
                eligible: false,
                reasonCode: 'SUBSCRIBER_NOT_ELIGIBLE',
                reasonMessage: 'Thuê bao không đủ điều kiện đăng ký gói',
              }
            : { eligible: true };
      log(
        `POST /packages/check ${JSON.stringify(input.packageCode)} ${JSON.stringify(input.msisdn ?? null)} → ${verdict.eligible ? 'được' : 'không được'}`,
      );
      reply(res, 200, 'OK', 'ok', verdict);
      return;
    }
    if (req.method === 'GET' && path === '/orders' && search) {
      const from = Date.parse(params.get('from') ?? '');
      const to = Date.parse(params.get('to') ?? '');
      const items = [...orders.values()].filter((order) => {
        const created = Date.parse(order.createdAt);
        return (
          (!Number.isFinite(from) || created >= from) &&
          (!Number.isFinite(to) || created <= to)
        );
      });
      log(`GET /orders?from&to → ${items.length} đơn`);
      reply(res, 200, 'OK', 'ok', { items });
      return;
    }
    if (req.method === 'GET' && path === '/ping') {
      reply(res, 200, 'OK', 'pong', { serverTime: nowIso() });
      return;
    }

    if (req.method === 'POST' && path === '/orders') {
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        reply(res, 400, 'INVALID_REQUEST', 'Body không phải JSON');
        return;
      }
      const invalid = validate(input ?? {});
      if (invalid) {
        log(`POST /orders → 400 ${invalid}`);
        reply(res, 400, 'INVALID_REQUEST', invalid);
        return;
      }
      const fingerprint = JSON.stringify([
        input.action,
        input.packageCode,
        input.msisdn ?? null,
        input.serial ?? null,
      ]);
      const existing = stored.get(input.requestId as string);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          log(`POST /orders ${existing.order.requestId} → 409 khác nội dung`);
          reply(
            res,
            409,
            'REQUEST_ID_CONFLICT',
            'requestId đã dùng cho đơn khác',
          );
          return;
        }
        log(
          `POST /orders ${existing.order.requestId} → 200 đơn đã có (${existing.order.status})`,
        );
        reply(res, 200, 'OK', 'Đơn đã tồn tại', existing.order);
        return;
      }
      const { order, failResponse } = createOrder(input);
      stored.set(order.requestId, { order, fingerprint });
      orders.set(order.requestId, order);
      if (failResponse) {
        log(`POST /orders ${order.requestId} → 500 (đơn vẫn được tạo)`);
        reply(res, 500, 'INTERNAL_ERROR', 'Lỗi giả lập sau khi đã tạo đơn');
        return;
      }
      log(
        `POST /orders ${order.requestId} ${order.msisdn ?? order.serial ?? ''} → 200 ${order.status}`,
      );
      reply(res, 200, 'OK', 'Đã nhận đơn', order);
      return;
    }

    const match = /^\/orders\/([^/?]+)$/.exec(path);
    if (req.method === 'GET' && match) {
      const requestId = decodeURIComponent(match[1]);
      const order = orders.get(requestId);
      if (!order) {
        log(`GET /orders/${requestId} → 404`);
        reply(res, 404, 'ORDER_NOT_FOUND', 'Chưa nhận đơn này');
        return;
      }
      log(`GET /orders/${requestId} → 200 ${order.status}`);
      reply(res, 200, 'OK', 'ok', order);
      return;
    }

    reply(res, 404, 'NOT_FOUND', `Không có ${req.method} ${url}`);
  }

  const server: Server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      log(
        `lỗi xử lý: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (!res.headersSent) reply(res, 500, 'INTERNAL_ERROR', 'Lỗi NCC giả');
    });
  });

  return {
    orders,
    callbacks,
    requests,
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
