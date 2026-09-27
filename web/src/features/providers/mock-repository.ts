import { ApiError } from "@/lib/api/errors";
import { sleep } from "@/lib/utils";
import type {
  ConnectionTestResult,
  Provider,
  ProviderCredentialsInput,
  ProviderCredentialSummary,
  ProviderInput,
  ProviderLog,
  ProviderRepository,
  ProviderUpdateInput,
} from "./types";

const STORAGE_KEY = "pih.demo.providers.v1";
const MINUTE = 60_000;

interface StoredLog extends ProviderLog {
  settleAt: number | null;
  plannedOutcome: "SUCCESS" | "FAILED" | null;
  plannedRecords: number | null;
}

interface DemoState {
  providers: Provider[];
  logs: StoredLog[];
}

let memory: DemoState | null = null;

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random: () => number, min: number, max: number): number {
  return Math.round(min + random() * (max - min));
}

function iso(time: number): string {
  return new Date(time).toISOString();
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyCredentials(): ProviderCredentialSummary {
  return { apiKeyLast4: null, clientId: null, username: null, hasSecret: false, updatedAt: null };
}

function seedState(now: number): DemoState {
  const random = createRandom(20260925);
  const blueprint: Array<
    Omit<Provider, "id" | "createdAt" | "updatedAt" | "lastConnectionCheckAt"> & { ageDays: number }
  > = [
    {
      code: "CRM_NOVA",
      name: "CRM Nova",
      category: "CRM",
      description: "Đồng bộ hồ sơ khách hàng và cơ hội bán hàng.",
      baseUrl: "https://api.crm-nova.example/v2",
      authType: "API_KEY",
      status: "ACTIVE",
      timeoutMs: 10000,
      syncIntervalMinutes: 30,
      credentials: {
        ...emptyCredentials(),
        apiKeyLast4: "9f2a",
        hasSecret: true,
        updatedAt: iso(now - 20 * 1440 * MINUTE),
      },
      lastSyncAt: iso(now - 12 * MINUTE),
      lastSyncStatus: "SUCCESS",
      lastSyncMessage: "Đồng bộ 1.284 bản ghi",
      lastLatencyMs: 142,
      ageDays: 64,
    },
    {
      code: "DELTA_LOGISTICS",
      name: "Kho vận Delta",
      category: "LOGISTICS",
      description: "Trạng thái vận đơn và tồn kho theo thời gian thực.",
      baseUrl: "https://delta-logistics.example/api",
      authType: "OAUTH2",
      status: "ACTIVE",
      timeoutMs: 15000,
      syncIntervalMinutes: 60,
      credentials: {
        ...emptyCredentials(),
        clientId: "delta-hub-client",
        hasSecret: true,
        updatedAt: iso(now - 9 * 1440 * MINUTE),
      },
      lastSyncAt: iso(now - 48 * MINUTE),
      lastSyncStatus: "SUCCESS",
      lastSyncMessage: "Đồng bộ 356 bản ghi",
      lastLatencyMs: 231,
      ageDays: 41,
    },
    {
      code: "ORION_PAY",
      name: "Cổng thanh toán Orion",
      category: "PAYMENT",
      description: "Đối soát giao dịch và trạng thái hoàn tiền.",
      baseUrl: "https://gateway.orion-pay.example",
      authType: "API_KEY",
      status: "ERROR",
      timeoutMs: 8000,
      syncIntervalMinutes: 15,
      credentials: {
        ...emptyCredentials(),
        apiKeyLast4: "11c0",
        hasSecret: true,
        updatedAt: iso(now - 95 * 1440 * MINUTE),
      },
      lastSyncAt: iso(now - 25 * MINUTE),
      lastSyncStatus: "FAILED",
      lastSyncMessage: "Xác thực thất bại: API key đã hết hạn (HTTP 401)",
      lastLatencyMs: null,
      ageDays: 120,
    },
    {
      code: "VEGA_SMS",
      name: "SMS Brandname Vega",
      category: "MESSAGING",
      description: "Gửi tin nhắn thông báo và OTP.",
      baseUrl: "https://sms.vega.example/v1",
      authType: "BASIC",
      status: "ACTIVE",
      timeoutMs: 5000,
      syncIntervalMinutes: 360,
      credentials: {
        ...emptyCredentials(),
        username: "hub_sender",
        hasSecret: true,
        updatedAt: iso(now - 30 * 1440 * MINUTE),
      },
      lastSyncAt: iso(now - 190 * MINUTE),
      lastSyncStatus: "SUCCESS",
      lastSyncMessage: "Đồng bộ 72 bản ghi",
      lastLatencyMs: 88,
      ageDays: 23,
    },
    {
      code: "ATLAS_ERP",
      name: "ERP Atlas",
      category: "ERP",
      description: "Danh mục sản phẩm và đơn đặt hàng nội bộ.",
      baseUrl: "https://erp-atlas.example/odata",
      authType: "OAUTH2",
      status: "INACTIVE",
      timeoutMs: 20000,
      syncIntervalMinutes: 1440,
      credentials: emptyCredentials(),
      lastSyncAt: null,
      lastSyncStatus: "NEVER",
      lastSyncMessage: null,
      lastLatencyMs: null,
      ageDays: 3,
    },
  ];

  const providers: Provider[] = blueprint.map(({ ageDays, ...rest }) => ({
    ...rest,
    id: newId(),
    createdAt: iso(now - ageDays * 1440 * MINUTE),
    updatedAt: iso(now - between(random, 1, 5) * 1440 * MINUTE),
    lastConnectionCheckAt: rest.lastLatencyMs !== null ? iso(now - between(random, 30, 240) * MINUTE) : null,
  }));

  const logs: StoredLog[] = [];
  const push = (log: Omit<StoredLog, "id" | "settleAt" | "plannedOutcome" | "plannedRecords">) =>
    logs.push({ ...log, id: newId(), settleAt: null, plannedOutcome: null, plannedRecords: null });

  for (const provider of providers) {
    if (provider.lastSyncStatus === "NEVER") {
      push({
        providerId: provider.id,
        providerName: provider.name,
        type: "CONFIG_UPDATE",
        status: "SUCCESS",
        message: "Khởi tạo nhà cung cấp",
        durationMs: null,
        recordsProcessed: null,
        triggeredBy: "system",
        createdAt: provider.createdAt,
        finishedAt: provider.createdAt,
      });
      continue;
    }
    const last = Date.parse(provider.lastSyncAt as string);
    const step = Math.max(provider.syncIntervalMinutes, 30) * MINUTE;
    for (let index = 0; index < 8; index += 1) {
      const startedAt = last - index * step - between(random, 0, 4) * MINUTE;
      const failed = index === 0 ? provider.lastSyncStatus === "FAILED" : random() < 0.12;
      const durationMs = between(random, 1400, 9800);
      const records = failed ? 0 : between(random, 40, 1600);
      push({
        providerId: provider.id,
        providerName: provider.name,
        type: "SYNC",
        status: failed ? "FAILED" : "SUCCESS",
        message: failed
          ? index === 0 && provider.lastSyncMessage
            ? provider.lastSyncMessage
            : "Hết thời gian chờ phản hồi từ nhà cung cấp"
          : `Đồng bộ ${records.toLocaleString("vi-VN")} bản ghi`,
        durationMs,
        recordsProcessed: records,
        triggeredBy: "scheduler",
        createdAt: iso(startedAt - durationMs),
        finishedAt: iso(startedAt),
      });
    }
    if (provider.lastConnectionCheckAt) {
      push({
        providerId: provider.id,
        providerName: provider.name,
        type: "CONNECTION_TEST",
        status: "SUCCESS",
        message: `Kết nối thành công (HTTP 200) sau ${provider.lastLatencyMs} ms`,
        durationMs: provider.lastLatencyMs,
        recordsProcessed: null,
        triggeredBy: "admin@demo.local",
        createdAt: provider.lastConnectionCheckAt,
        finishedAt: provider.lastConnectionCheckAt,
      });
    }
  }

  return { providers, logs };
}

function persist(): void {
  if (!memory) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    return;
  }
}

function load(): DemoState {
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      memory = JSON.parse(raw) as DemoState;
      return memory;
    }
  } catch {
    memory = null;
  }
  memory = seedState(Date.now());
  persist();
  return memory;
}

function settle(): DemoState {
  const state = load();
  const now = Date.now();
  let changed = false;
  for (const log of state.logs) {
    if (log.status !== "RUNNING" || log.settleAt === null || log.settleAt > now || !log.plannedOutcome) continue;
    const success = log.plannedOutcome === "SUCCESS";
    const records = success ? (log.plannedRecords ?? 0) : 0;
    log.status = log.plannedOutcome;
    log.finishedAt = iso(log.settleAt);
    log.durationMs = log.settleAt - Date.parse(log.createdAt);
    log.recordsProcessed = records;
    log.message = success
      ? `Đồng bộ ${records.toLocaleString("vi-VN")} bản ghi`
      : "Nhà cung cấp từ chối yêu cầu: thông tin xác thực không hợp lệ (HTTP 401)";
    const provider = state.providers.find((item) => item.id === log.providerId);
    if (provider) {
      provider.lastSyncAt = log.finishedAt;
      provider.lastSyncStatus = log.status;
      provider.lastSyncMessage = log.message;
      if (!success && provider.status === "ACTIVE") provider.status = "ERROR";
    }
    changed = true;
  }
  if (changed) persist();
  return state;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function publicLog(log: StoredLog): ProviderLog {
  const { settleAt: _settleAt, plannedOutcome: _plannedOutcome, plannedRecords: _plannedRecords, ...rest } = log;
  return clone(rest);
}

async function latency(min = 280, max = 720): Promise<void> {
  await sleep(min + Math.random() * (max - min));
}

function findProvider(state: DemoState, id: string): Provider {
  const provider = state.providers.find((item) => item.id === id);
  if (!provider) throw new ApiError({ status: 404, messages: ["Không tìm thấy nhà cung cấp"] });
  return provider;
}

function credentialsReady(provider: Provider): boolean {
  const { credentials } = provider;
  if (provider.authType === "API_KEY") return Boolean(credentials.apiKeyLast4);
  if (provider.authType === "OAUTH2") return Boolean(credentials.clientId) && credentials.hasSecret;
  return Boolean(credentials.username) && credentials.hasSecret;
}

function applyCredentials(
  current: ProviderCredentialSummary,
  input: ProviderCredentialsInput | undefined,
): ProviderCredentialSummary {
  if (!input) return current;
  const next = { ...current };
  let touched = false;
  if (input.apiKey) {
    next.apiKeyLast4 = input.apiKey.slice(-4);
    next.hasSecret = true;
    touched = true;
  }
  if (input.clientId !== undefined && input.clientId !== "") {
    next.clientId = input.clientId;
    touched = true;
  }
  if (input.username !== undefined && input.username !== "") {
    next.username = input.username;
    touched = true;
  }
  if (input.clientSecret || input.password) {
    next.hasSecret = true;
    touched = true;
  }
  if (touched) next.updatedAt = iso(Date.now());
  return next;
}

const FIELD_LABELS: Partial<Record<keyof ProviderUpdateInput, string>> = {
  name: "tên",
  category: "nhóm",
  description: "mô tả",
  baseUrl: "URL",
  authType: "phương thức xác thực",
  timeoutMs: "timeout",
  syncIntervalMinutes: "chu kỳ đồng bộ",
  status: "trạng thái",
  credentials: "thông tin xác thực",
};

export const mockProviderRepository: ProviderRepository = {
  async list() {
    await latency();
    const state = settle();
    return clone(state.providers).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  },

  async get(id) {
    await latency(180, 420);
    return clone(findProvider(settle(), id));
  },

  async create(input: ProviderInput, actor: string) {
    await latency(400, 800);
    const state = settle();
    if (state.providers.some((item) => item.code === input.code)) {
      throw new ApiError({ status: 409, messages: [`Mã nhà cung cấp ${input.code} đã tồn tại`] });
    }
    const now = iso(Date.now());
    const provider: Provider = {
      id: newId(),
      code: input.code,
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      baseUrl: input.baseUrl,
      authType: input.authType,
      status: input.status,
      timeoutMs: input.timeoutMs,
      syncIntervalMinutes: input.syncIntervalMinutes,
      credentials: applyCredentials(emptyCredentials(), input.credentials),
      lastSyncAt: null,
      lastSyncStatus: "NEVER",
      lastSyncMessage: null,
      lastConnectionCheckAt: null,
      lastLatencyMs: null,
      createdAt: now,
      updatedAt: now,
    };
    state.providers.push(provider);
    state.logs.push({
      id: newId(),
      providerId: provider.id,
      providerName: provider.name,
      type: "CONFIG_UPDATE",
      status: "SUCCESS",
      message: "Khởi tạo nhà cung cấp",
      durationMs: null,
      recordsProcessed: null,
      triggeredBy: actor,
      createdAt: now,
      finishedAt: now,
      settleAt: null,
      plannedOutcome: null,
      plannedRecords: null,
    });
    persist();
    return clone(provider);
  },

  async update(id, input, actor) {
    await latency(350, 700);
    const state = settle();
    const provider = findProvider(state, id);
    const changed = (Object.keys(input) as Array<keyof ProviderUpdateInput>)
      .filter((key) => input[key] !== undefined)
      .map((key) => FIELD_LABELS[key])
      .filter(Boolean);
    const { credentials, ...fields } = input;
    Object.assign(provider, Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)));
    provider.credentials = applyCredentials(provider.credentials, credentials);
    provider.updatedAt = iso(Date.now());
    state.logs.push({
      id: newId(),
      providerId: provider.id,
      providerName: provider.name,
      type: "CONFIG_UPDATE",
      status: "SUCCESS",
      message: changed.length > 0 ? `Cập nhật ${changed.join(", ")}` : "Lưu cấu hình",
      durationMs: null,
      recordsProcessed: null,
      triggeredBy: actor,
      createdAt: provider.updatedAt,
      finishedAt: provider.updatedAt,
      settleAt: null,
      plannedOutcome: null,
      plannedRecords: null,
    });
    persist();
    return clone(provider);
  },

  async remove(id) {
    await latency();
    const state = settle();
    findProvider(state, id);
    state.providers = state.providers.filter((item) => item.id !== id);
    state.logs = state.logs.filter((log) => log.providerId !== id);
    persist();
  },

  async testConnection(id, actor) {
    const state = settle();
    const provider = findProvider(state, id);
    const startedAt = Date.now();
    await latency(500, 1300);
    const ready = credentialsReady(provider);
    const latencyMs = ready ? Math.round(60 + Math.random() * 260) : Date.now() - startedAt;
    const result: ConnectionTestResult = ready
      ? {
          success: true,
          latencyMs,
          statusCode: 200,
          message: `Kết nối thành công (HTTP 200) sau ${latencyMs} ms`,
          checkedAt: iso(Date.now()),
        }
      : {
          success: false,
          latencyMs,
          statusCode: 401,
          message: "Thiếu hoặc sai thông tin xác thực: nhà cung cấp trả về HTTP 401",
          checkedAt: iso(Date.now()),
        };
    provider.lastConnectionCheckAt = result.checkedAt;
    provider.lastLatencyMs = result.success ? latencyMs : null;
    if (result.success && provider.status === "ERROR") provider.status = "ACTIVE";
    if (!result.success && provider.status === "ACTIVE") provider.status = "ERROR";
    state.logs.push({
      id: newId(),
      providerId: provider.id,
      providerName: provider.name,
      type: "CONNECTION_TEST",
      status: result.success ? "SUCCESS" : "FAILED",
      message: result.message,
      durationMs: latencyMs,
      recordsProcessed: null,
      triggeredBy: actor,
      createdAt: result.checkedAt,
      finishedAt: result.checkedAt,
      settleAt: null,
      plannedOutcome: null,
      plannedRecords: null,
    });
    persist();
    return result;
  },

  async triggerSync(id, actor) {
    await latency(300, 600);
    const state = settle();
    const provider = findProvider(state, id);
    if (provider.status === "INACTIVE") {
      throw new ApiError({ status: 409, messages: ["Nhà cung cấp đang tạm dừng. Hãy kích hoạt trước khi đồng bộ."] });
    }
    if (provider.lastSyncStatus === "RUNNING") {
      throw new ApiError({ status: 409, messages: ["Đang có một phiên đồng bộ chạy cho nhà cung cấp này."] });
    }
    const now = Date.now();
    const success = provider.status !== "ERROR" && credentialsReady(provider);
    const log: StoredLog = {
      id: newId(),
      providerId: provider.id,
      providerName: provider.name,
      type: "SYNC",
      status: "RUNNING",
      message: "Đang đồng bộ dữ liệu…",
      durationMs: null,
      recordsProcessed: null,
      triggeredBy: actor,
      createdAt: iso(now),
      finishedAt: null,
      settleAt: now + 2500 + Math.round(Math.random() * 3500),
      plannedOutcome: success ? "SUCCESS" : "FAILED",
      plannedRecords: success ? 40 + Math.round(Math.random() * 1500) : 0,
    };
    state.logs.push(log);
    provider.lastSyncStatus = "RUNNING";
    provider.lastSyncMessage = log.message;
    persist();
    return publicLog(log);
  },

  async logs(id, limit = 50) {
    await latency(200, 450);
    const state = settle();
    return state.logs
      .filter((log) => log.providerId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(publicLog);
  },

  async recentActivity(limit = 12) {
    await latency(200, 450);
    const state = settle();
    return [...state.logs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(publicLog);
  },

  async resetDemoData() {
    await latency(200, 400);
    memory = seedState(Date.now());
    persist();
  },
};
