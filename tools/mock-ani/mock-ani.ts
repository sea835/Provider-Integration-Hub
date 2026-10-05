import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import { AddressInfo } from 'node:net';

/**
 * ANI SIM giả theo dạng API Agency v3.0 (ani_agency.pdf): header X-API-Key, mã lỗi kiểu ANI,
 * tra cứu bằng keyword khớp gần đúng, callback ORDER_RESULT. Dùng để thử tích hợp "Tự cấu hình".
 */
export interface MockAniOptions {
  apiKey: string;
  callbackUrl?: string;
  delayMs: number;
  callbackRetryDelaysMs: number[];
  log?: (line: string) => void;
}

interface AniOrder {
  id: string;
  code: string;
  requestId: string;
  packagePlanId: string;
  status: number;
  qrStatus: number;
  msisdn: string | null;
  serial: string | null;
  lpa: string | null;
  urlLpa: string | null;
  totalAmount: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface MockAni {
  readonly orders: Map<string, AniOrder>;
  readonly requests: string[];
  readonly callbacks: Array<{
    eventId: string;
    requestId: string;
    attempt: number;
    httpStatus: number | null;
  }>;
  listen(port: number): Promise<number>;
  close(): Promise<void>;
}

const PACKAGE_PLANS = [
  {
    id: 'plan-esim-5gb',
    name: 'eSIM 5GB / 30 ngày',
    type: 'ESIM',
    price: '95000.00',
  },
  {
    id: 'plan-sim-10gb',
    name: 'SIM 10GB / 30 ngày',
    type: 'SIM',
    price: '120000.00',
  },
];

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(
  res: ServerResponse,
  status: number,
  code: number,
  message: string,
  data: unknown = null,
) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ code, message, data }));
}

export function createMockAni(options: MockAniOptions): MockAni {
  const orders = new Map<string, AniOrder>();
  const requests: string[] = [];
  const callbacks: MockAni['callbacks'] = [];
  const timers = new Set<NodeJS.Timeout>();
  const log = options.log ?? (() => undefined);
  let seq = 0;
  let eventSeq = 0;

  function later(ms: number, fn: () => void) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  }

  function sendCallback(order: AniOrder, eventId: string, attempt = 1) {
    if (!options.callbackUrl) return;
    const body = JSON.stringify({
      event: 'ORDER_RESULT',
      eventId,
      requestId: order.requestId,
      data: order,
    });
    const record = (httpStatus: number | null) => {
      callbacks.push({
        eventId,
        requestId: order.requestId,
        attempt,
        httpStatus,
      });
      log(
        `callback ${order.requestId} status ${order.status} lần ${attempt} → ${httpStatus ?? 'lỗi mạng'}`,
      );
      const ok = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;
      const next = options.callbackRetryDelaysMs[attempt - 1];
      if (!ok && next !== undefined)
        later(next, () => sendCallback(order, eventId, attempt + 1));
    };
    fetch(options.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MK-Callback-Id': eventId,
        'X-MK-Callback-Event': 'ORDER_RESULT',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
      .then((res) => record(res.status))
      .catch(() => record(null));
  }

  function finish(
    order: AniOrder,
    outcome: 'COMPLETED' | 'FAILED' | 'CANCELLED',
    silent: boolean,
  ) {
    if (outcome === 'COMPLETED') {
      order.status = 4;
      order.qrStatus = order.serial ? 0 : 2;
      order.msisdn = order.msisdn ?? `09${String(10000000 + seq).slice(-8)}`;
      if (!order.serial) {
        order.lpa = `LPA:1$smdp.mock-ani.local$${order.code}`;
        order.urlLpa = `https://mock-ani.local/qr/${order.id}`;
      }
    } else if (outcome === 'FAILED') {
      order.status = 5;
      order.errorCode = '4012';
      order.errorMessage = 'Kích hoạt thất bại tại nhà mạng';
    } else {
      order.status = 6;
      order.errorMessage = 'Đơn đã bị huỷ';
    }
    log(`đơn ${order.requestId} chuyển status ${order.status}`);
    if (!silent) sendCallback(order, `EV-${++eventSeq}-${order.id}`);
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const rawBody = await readBody(req);
    const url = new URL(req.url ?? '/', 'http://mock-ani.local');
    requests.push(`${req.method} ${url.pathname}${url.search}`);

    if (req.method === 'GET' && url.pathname === '/_mock/orders') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([...orders.values()], null, 2));
      return;
    }
    if (req.headers['x-api-key'] !== options.apiKey) {
      log(`${req.method} ${url.pathname} → 401 sai API key`);
      send(res, 401, 2002, 'Invalid API key');
      return;
    }

    if (
      req.method === 'GET' &&
      url.pathname === '/api/v1/agency/package-plans'
    ) {
      send(res, 200, 0, 'Success', {
        items: PACKAGE_PLANS,
        total: PACKAGE_PLANS.length,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/agency/orders') {
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        send(res, 400, 4000, 'Invalid JSON');
        return;
      }
      const requestId =
        typeof input.requestId === 'string' ? input.requestId : '';
      const packagePlanId =
        typeof input.packagePlanId === 'string' ? input.packagePlanId : '';
      const serial = typeof input.serial === 'string' ? input.serial : null;
      if (!requestId || !packagePlanId) {
        send(res, 400, 4000, 'requestId and packagePlanId are required');
        return;
      }
      if (orders.has(requestId)) {
        log(`POST orders ${requestId} → 409 trùng requestId`);
        send(res, 409, 4002, 'Duplicate requestId');
        return;
      }
      if (packagePlanId === 'NOT_EXIST') {
        log(`POST orders ${requestId} → 404 gói không tồn tại`);
        send(res, 404, 4000, 'Package plan not found');
        return;
      }
      if (serial?.endsWith('0002')) {
        log(`POST orders ${requestId} → 400 serial không dùng được`);
        send(res, 400, 4001, 'Serial is not available');
        return;
      }
      seq += 1;
      const order: AniOrder = {
        id: `ani-${String(seq).padStart(6, '0')}`,
        code: `ANI${String(seq).padStart(8, '0')}`,
        requestId,
        packagePlanId,
        status: 1,
        qrStatus: 0,
        msisdn: null,
        serial,
        lpa: null,
        urlLpa: null,
        totalAmount: '95000.00',
        errorCode: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
      };
      orders.set(requestId, order);
      const outcome = serial?.endsWith('0005')
        ? 'FAILED'
        : serial?.endsWith('0006')
          ? 'CANCELLED'
          : 'COMPLETED';
      const silent = Boolean(serial?.endsWith('0009'));
      later(options.delayMs, () => finish(order, outcome, silent));
      log(`POST orders ${requestId} ${serial ?? 'eSIM'} → 201 status 1`);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 0, message: 'Success', data: order }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/agency/orders') {
      const keyword = url.searchParams.get('keyword') ?? '';
      const items = [...orders.values()].filter((order) =>
        order.requestId.includes(keyword),
      );
      log(`GET orders keyword=${keyword} → ${items.length} đơn`);
      send(res, 200, 0, 'Success', { items, total: items.length });
      return;
    }

    send(res, 404, 4000, `Not found: ${req.method} ${url.pathname}`);
  }

  const server: Server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) send(res, 500, 5000, 'Internal error');
    });
  });

  return {
    orders,
    requests,
    callbacks,
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
