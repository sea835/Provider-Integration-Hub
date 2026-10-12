import {
  AUTH_TYPES,
  AuthSpec,
  BODY_TYPES,
  BalanceSpec,
  BodyField,
  CALL_KINDS,
  CallKind,
  Condition,
  HOST_KEY,
  HTTP_METHODS,
  HostSpec,
  IntegrationSpec,
  KeyValue,
  MAX_HOSTS,
  OPERATORS,
  ProviderConfig,
  ProviderSamples,
  RequestSpec,
  ResponseSample,
  SIGN_ALGORITHMS,
  SIGN_ENCODINGS,
  SIGN_INPUTS,
  SIGN_TARGETS,
  SignatureSpec,
  TokenSpec,
  VALUE_TYPES,
  defaultSpec,
} from '@modules/provider/domain/provider-config';

export const VAR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,49}$/;
const SECRET_REFERENCE = /\{\{[^{}]*?\bsecrets\.([A-Za-z0-9_]+)/g;
const VAR_REFERENCE = /\{\{[^{}]*?\bvars\.([A-Za-z0-9_]+)/g;
const ABSOLUTE_URL = /^https?:\/\//i;
const MAX_TEXT = 2000;
const MAX_ITEMS = 50;
/** Kích thước tối đa của một phản hồi mẫu (ký tự JSON). */
const MAX_SAMPLE_LENGTH = 100_000;

type Raw = Record<string, unknown>;

class Reader {
  readonly issues: string[] = [];

  object(value: unknown, path: string): Raw {
    if (value === undefined || value === null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) {
      this.issues.push(`${path} phải là đối tượng`);
      return {};
    }
    return value as Raw;
  }

  string(value: unknown, path: string, fallback = ''): string {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (typeof value !== 'string') {
      this.issues.push(`${path} phải là chuỗi`);
      return fallback;
    }
    if (value.length > MAX_TEXT) {
      this.issues.push(`${path} dài tối đa ${MAX_TEXT} ký tự`);
      return fallback;
    }
    return value.trim();
  }

  integer(
    value: unknown,
    path: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    if (value === undefined || value === null || value === '') return fallback;
    const num = Number(value);
    if (!Number.isInteger(num) || num < min || num > max) {
      this.issues.push(`${path} phải là số nguyên từ ${min} đến ${max}`);
      return fallback;
    }
    return num;
  }

  boolean(value: unknown, path: string, fallback = false): boolean {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'boolean') {
      this.issues.push(`${path} phải là true hoặc false`);
      return fallback;
    }
    return value;
  }

  oneOf<T extends string>(
    value: unknown,
    allowed: readonly T[],
    path: string,
    fallback: T,
  ): T {
    if (value === undefined || value === null || value === '') return fallback;
    if (
      typeof value === 'string' &&
      (allowed as readonly string[]).includes(value)
    ) {
      return value as T;
    }
    this.issues.push(`${path} phải là một trong: ${allowed.join(', ')}`);
    return fallback;
  }

  list<T>(
    value: unknown,
    path: string,
    item: (raw: unknown, at: string) => T,
  ): T[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      this.issues.push(`${path} phải là danh sách`);
      return [];
    }
    if (value.length > MAX_ITEMS) {
      this.issues.push(`${path} tối đa ${MAX_ITEMS} dòng`);
      return [];
    }
    return value.map((raw, index) => item(raw, `${path}[${index}]`));
  }

  keyValue = (raw: unknown, path: string): KeyValue => {
    const o = this.object(raw, path);
    const name = this.string(o.name, `${path}.name`);
    if (!name) this.issues.push(`${path}.name không được để trống`);
    return {
      name,
      value: this.string(o.value, `${path}.value`),
      omitIfEmpty: this.boolean(o.omitIfEmpty, `${path}.omitIfEmpty`),
    };
  };

  bodyField = (raw: unknown, path: string): BodyField => {
    const o = this.object(raw, path);
    const key = this.string(o.key, `${path}.key`);
    if (!key) this.issues.push(`${path}.key không được để trống`);
    return {
      key,
      value: this.string(o.value, `${path}.value`),
      type: this.oneOf(o.type, VALUE_TYPES, `${path}.type`, 'string'),
      omitIfEmpty: this.boolean(o.omitIfEmpty, `${path}.omitIfEmpty`),
    };
  };

  condition = (raw: unknown, path: string): Condition => {
    const o = this.object(raw, path);
    const conditionPath = this.string(o.path, `${path}.path`);
    if (!conditionPath) this.issues.push(`${path}.path không được để trống`);
    const operator = this.oneOf(
      o.operator,
      OPERATORS,
      `${path}.operator`,
      'IN',
    );
    const values = this.list(o.values, `${path}.values`, (v, at) =>
      this.string(v, at),
    ).filter((value) => value !== '');
    if ((operator === 'IN' || operator === 'NOT_IN') && values.length === 0) {
      this.issues.push(`${path}.values cần ít nhất một giá trị`);
    }
    return { path: conditionPath, operator, values };
  };

  /** Không ghi `bodyType`: GET không có body, phương thức khác mặc định JSON. */
  request(raw: unknown, path: string, fallback: RequestSpec): RequestSpec {
    const o = this.object(raw, path);
    const method = this.oneOf(
      o.method,
      HTTP_METHODS,
      `${path}.method`,
      fallback.method,
    );
    return {
      host: this.string(o.host, `${path}.host`),
      method,
      path: this.string(o.path, `${path}.path`),
      query: this.list(o.query, `${path}.query`, this.keyValue),
      bodyType: this.oneOf(
        o.bodyType,
        BODY_TYPES,
        `${path}.bodyType`,
        method === 'GET' ? 'NONE' : 'JSON',
      ),
      body: this.list(o.body, `${path}.body`, this.bodyField),
    };
  }

  conditions(raw: unknown, path: string, fallback: Condition[]): Condition[] {
    return raw === undefined ? fallback : this.list(raw, path, this.condition);
  }
}

function readAuth(r: Reader, raw: unknown): AuthSpec {
  const o = r.object(raw, 'spec.auth');
  return {
    type: r.oneOf(o.type, AUTH_TYPES, 'spec.auth.type', 'NONE'),
    name: r.string(o.name, 'spec.auth.name'),
    value: r.string(o.value, 'spec.auth.value'),
    username: r.string(o.username, 'spec.auth.username'),
    password: r.string(o.password, 'spec.auth.password'),
  };
}

function readToken(r: Reader, raw: unknown, base: TokenSpec): TokenSpec {
  const o = r.object(raw, 'spec.token');
  return {
    enabled: r.boolean(o.enabled, 'spec.token.enabled'),
    request: r.request(o.request, 'spec.token.request', base.request),
    success: r.conditions(o.success, 'spec.token.success', base.success),
    tokenPath: r.string(o.tokenPath, 'spec.token.tokenPath'),
    expiresInPath: r.string(o.expiresInPath, 'spec.token.expiresInPath'),
    ttlSec: r.integer(
      o.ttlSec,
      'spec.token.ttlSec',
      base.ttlSec,
      60,
      30 * 86400,
    ),
    refreshOn: r.conditions(
      o.refreshOn,
      'spec.token.refreshOn',
      base.refreshOn,
    ),
  };
}

function readSignature(
  r: Reader,
  raw: unknown,
  base: SignatureSpec,
): SignatureSpec {
  const path = 'spec.signature';
  const o = r.object(raw, path);
  const apply = r.object(o.apply, `${path}.apply`);
  return {
    enabled: r.boolean(o.enabled, `${path}.enabled`),
    algorithm: r.oneOf(
      o.algorithm,
      SIGN_ALGORITHMS,
      `${path}.algorithm`,
      base.algorithm,
    ),
    key: r.string(o.key, `${path}.key`),
    input: r.oneOf(o.input, SIGN_INPUTS, `${path}.input`, base.input),
    template: r.string(o.template, `${path}.template`),
    encoding: r.oneOf(
      o.encoding,
      SIGN_ENCODINGS,
      `${path}.encoding`,
      base.encoding,
    ),
    target: r.oneOf(o.target, SIGN_TARGETS, `${path}.target`, base.target),
    name: r.string(o.name, `${path}.name`, base.name),
    apply: Object.fromEntries(
      CALL_KINDS.map((kind) => [
        kind,
        r.boolean(apply[kind], `${path}.apply.${kind}`, base.apply[kind]),
      ]),
    ) as Record<CallKind, boolean>,
  };
}

function readBalance(r: Reader, raw: unknown, base: BalanceSpec): BalanceSpec {
  const path = 'spec.balance';
  const o = r.object(raw, path);
  return {
    request: r.request(o.request, `${path}.request`, base.request),
    success: r.conditions(o.success, `${path}.success`, base.success),
    balancePath: r.string(o.balancePath, `${path}.balancePath`),
    errorCodePath: r.string(o.errorCodePath, `${path}.errorCodePath`),
    errorMessagePath: r.string(
      o.errorMessagePath,
      `${path}.errorMessagePath`,
      base.errorMessagePath,
    ),
  };
}

function readHosts(r: Reader, raw: unknown): HostSpec[] {
  const hosts = r.list(raw, 'hosts', (item, at) => {
    const o = r.object(item, at);
    const key = r.string(o.key, `${at}.key`);
    const url = r.string(o.url, `${at}.url`).replace(/\/+$/, '');
    if (!HOST_KEY.test(key)) {
      r.issues.push(
        `${at}.key phải bắt đầu bằng chữ, chỉ gồm chữ, số, gạch dưới (tối đa 30 ký tự)`,
      );
    }
    if (url && !isHttpUrl(url)) {
      r.issues.push(`${at}.url phải là địa chỉ http:// hoặc https:// hợp lệ`);
    }
    return { key, label: r.string(o.label, `${at}.label`).slice(0, 100), url };
  });
  if (hosts.length > MAX_HOSTS) {
    r.issues.push(`hosts tối đa ${MAX_HOSTS} địa chỉ`);
  }
  const seen = new Set<string>();
  for (const host of hosts) {
    if (seen.has(host.key)) r.issues.push(`hosts: trùng tên ${host.key}`);
    seen.add(host.key);
  }
  return hosts.slice(0, MAX_HOSTS);
}

function readVars(r: Reader, raw: unknown): Record<string, string> {
  const o = r.object(raw, 'vars');
  const entries = Object.entries(o);
  if (entries.length > MAX_ITEMS) {
    r.issues.push(`vars tối đa ${MAX_ITEMS} biến`);
    return {};
  }
  const vars: Record<string, string> = {};
  for (const [name, value] of entries) {
    if (!VAR_NAME.test(name)) {
      r.issues.push(
        `vars.${name}: tên biến chỉ gồm chữ, số, gạch dưới và bắt đầu bằng chữ`,
      );
      continue;
    }
    vars[name] = r.string(value, `vars.${name}`);
  }
  return vars;
}

export interface ParsedConfig {
  config: ProviderConfig;
  /** Lỗi kiểu / giá trị: có lỗi thì không được lưu. */
  issues: string[];
}

/** Chuẩn hoá cấu hình gửi lên: điền mặc định cho phần thiếu, gom lỗi kiểu dữ liệu. */
export function parseProviderConfig(raw: unknown): ParsedConfig {
  const r = new Reader();
  const base = defaultSpec();
  const root = r.object(raw, 'config');
  const spec = r.object(root.spec, 'spec');
  const baseUrl = r.string(root.baseUrl, 'baseUrl').replace(/\/+$/, '');
  if (baseUrl && !isHttpUrl(baseUrl)) {
    r.issues.push('baseUrl phải là địa chỉ http:// hoặc https:// hợp lệ');
  }
  const config: ProviderConfig = {
    baseUrl,
    hosts: readHosts(r, root.hosts),
    vars: readVars(r, root.vars),
    spec: {
      auth: readAuth(r, spec.auth),
      token: readToken(r, spec.token, base.token),
      signature: readSignature(r, spec.signature, base.signature),
      headers: r.list(spec.headers, 'spec.headers', r.keyValue),
      balance: readBalance(r, spec.balance, base.balance),
    },
  };
  return { config, issues: r.issues };
}

/** Cấu hình đọc từ DB: điền mặc định cho trường thêm sau này (vd `hosts`), bỏ qua lỗi kiểu. */
export function normalizeProviderConfig(raw: unknown): ProviderConfig {
  return parseProviderConfig(raw).config;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function references(spec: IntegrationSpec, pattern: RegExp): Set<string> {
  const found = new Set<string>();
  for (const match of JSON.stringify(spec).matchAll(pattern)) {
    found.add(match[1]);
  }
  return found;
}

function requestIssues(
  label: string,
  request: RequestSpec,
  config: ProviderConfig,
): string[] {
  if (request.host) {
    const host = config.hosts.find((item) => item.key === request.host);
    if (!host) {
      return [
        `${label} đang gọi tới Base URL "${request.host}" nhưng địa chỉ này không còn trong danh sách`,
      ];
    }
    return host.url ? [] : [`Base URL "${host.key}" chưa nhập địa chỉ`];
  }
  if (ABSOLUTE_URL.test(request.path)) return [];
  if (!config.baseUrl) {
    return [`Chưa nhập Base URL mặc định (cần cho ${label})`];
  }
  return [];
}

/**
 * SCAN: đủ để bật quét. TRY_BALANCE / TRY_LOGIN: đủ để gọi thử và xem phản hồi, chưa cần biết
 * số dư (hay token) nằm ở đâu trong phản hồi vì gọi thử chính là để tìm ra điều đó.
 */
export type ReadinessMode = 'SCAN' | 'TRY_BALANCE' | 'TRY_LOGIN';

/** Những gì còn thiếu để gọi được API. Rỗng = sẵn sàng. */
export function readinessIssues(
  config: ProviderConfig,
  secretKeys: string[],
  mode: ReadinessMode = 'SCAN',
): string[] {
  const { spec } = config;
  const issues = new Set<string>();
  if (mode !== 'TRY_LOGIN') {
    for (const issue of requestIssues(
      'API số dư',
      spec.balance.request,
      config,
    )) {
      issues.add(issue);
    }
  }
  if (mode === 'SCAN' && !spec.balance.balancePath) {
    issues.add('Chưa nhập đường dẫn tới số dư trong phản hồi');
  }
  if (mode === 'TRY_LOGIN' && !spec.token.enabled) {
    issues.add('Chưa bật Đăng nhập lấy token');
  }
  if (spec.token.enabled) {
    for (const issue of requestIssues(
      'API đăng nhập',
      spec.token.request,
      config,
    )) {
      issues.add(issue);
    }
    if (!spec.token.request.path) {
      issues.add('Chưa nhập đường dẫn API đăng nhập');
    }
    if (mode !== 'TRY_LOGIN' && !spec.token.tokenPath) {
      issues.add('Chưa nhập đường dẫn tới token trong phản hồi đăng nhập');
    }
  }
  if (spec.signature.enabled) {
    if (spec.signature.algorithm.startsWith('HMAC') && !spec.signature.key) {
      issues.add('Chữ ký HMAC cần khoá ký');
    }
    if (spec.signature.input === 'TEMPLATE' && !spec.signature.template) {
      issues.add('Chưa nhập mẫu chuỗi đem ký');
    }
    if (!spec.signature.name) {
      issues.add('Chưa nhập tên header / trường chứa chữ ký');
    }
  }
  if (
    (spec.auth.type === 'HEADER' || spec.auth.type === 'QUERY') &&
    !spec.auth.name
  ) {
    issues.add('Xác thực theo header / query cần tên tham số');
  }
  const known = new Set(secretKeys);
  for (const name of references(spec, SECRET_REFERENCE)) {
    if (!known.has(name)) issues.add(`Chưa nhập bí mật "${name}"`);
  }
  for (const name of references(spec, VAR_REFERENCE)) {
    if (!(name in config.vars)) issues.add(`Chưa khai báo biến "${name}"`);
  }
  return [...issues];
}

function readSample(r: Reader, raw: unknown, path: string): ResponseSample {
  const o = r.object(raw, path);
  let length = 0;
  try {
    length = JSON.stringify(o.body ?? null).length;
  } catch {
    r.issues.push(`${path}.body phải là JSON`);
  }
  if (length > MAX_SAMPLE_LENGTH) {
    r.issues.push(
      `${path}.body quá lớn (tối đa ${MAX_SAMPLE_LENGTH} ký tự JSON)`,
    );
  }
  const capturedAt = r.string(o.capturedAt, `${path}.capturedAt`);
  return {
    httpStatus: r.integer(o.httpStatus, `${path}.httpStatus`, 200, 100, 599),
    body: o.body ?? null,
    capturedAt: Number.isNaN(Date.parse(capturedAt))
      ? new Date().toISOString()
      : capturedAt,
  };
}

/** Chuẩn hoá các phản hồi mẫu gửi lên; `null` ở một lời gọi nghĩa là xoá mẫu đó. */
export function parseProviderSamples(
  raw: unknown,
  current: ProviderSamples | null,
): { samples: ProviderSamples; issues: string[] } {
  const r = new Reader();
  const root = r.object(raw, 'samples');
  const samples: ProviderSamples = { ...(current ?? {}) };
  for (const kind of CALL_KINDS) {
    if (root[kind] === undefined) continue;
    if (root[kind] === null) delete samples[kind];
    else samples[kind] = readSample(r, root[kind], `samples.${kind}`);
  }
  return { samples, issues: r.issues };
}
