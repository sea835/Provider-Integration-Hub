import {
  ORDER_ACTION_VALUES,
  OrderActionType,
} from '@modules/provider-adapter/domain/order-action';
import {
  EXTRA_FIELD_KEY,
  EXTRA_FIELD_TYPES,
  FIELD_RULES,
  MAX_EXTRA_FIELDS,
  OrderExtraField,
  OrderFieldRules,
} from '@modules/provider-adapter/domain/order-fields';
import {
  AUTH_TYPES,
  AuthSpec,
  BODY_TYPES,
  BodyField,
  CALL_KINDS,
  CallbackSpec,
  CallKind,
  CheckSpec,
  Condition,
  defaultSignatureRule,
  defaultSpec,
  HTTP_METHODS,
  HttpConfigParams,
  IntegrationSpec,
  KeyValue,
  OPERATORS,
  ORDER_OUTCOMES,
  MATCH_BY,
  MAX_SIGNATURE_RULES,
  OrderMapping,
  OrdersSpec,
  PackagesSpec,
  QUERY_SOURCES,
  QuerySpec,
  RESULT_MODES,
  RequestSpec,
  Rule,
  RULE_OUTCOMES,
  SIGN_ALGORITHMS,
  SIGN_ENCODINGS,
  SIGN_INPUTS,
  SIGN_TARGETS,
  SignatureRule,
  SignatureSpec,
  StatusMapping,
  TokenSpec,
  VALUE_TYPES,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import { listAnchor } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.template';

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,49}$/;
const REFERENCE = /\{\{([^{}]+)\}\}/g;

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
    );
    if ((operator === 'IN' || operator === 'NOT_IN') && values.length === 0) {
      this.issues.push(`${path}.values cần ít nhất một giá trị`);
    }
    return { path: conditionPath, operator, values };
  };

  request(raw: unknown, path: string, fallback: RequestSpec): RequestSpec {
    const o = this.object(raw, path);
    return {
      method: this.oneOf(
        o.method,
        HTTP_METHODS,
        `${path}.method`,
        fallback.method,
      ),
      path: this.string(o.path, `${path}.path`),
      query: this.list(o.query, `${path}.query`, this.keyValue),
      bodyType: this.oneOf(
        o.bodyType,
        BODY_TYPES,
        `${path}.bodyType`,
        fallback.bodyType,
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

function readSignatureRule(
  r: Reader,
  raw: unknown,
  path: string,
): SignatureRule {
  const base = defaultSignatureRule();
  const o = r.object(raw, path);
  const apply = r.object(o.apply, `${path}.apply`);
  return {
    label: r.string(o.label, `${path}.label`, base.label).slice(0, 60),
    methods: [
      ...new Set(
        r.list(o.methods, `${path}.methods`, (item, at) =>
          r.oneOf(item, HTTP_METHODS, at, 'GET'),
        ),
      ),
    ],
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

/** Nhận cả dạng cũ (một chữ ký phẳng) lẫn dạng mới (danh sách quy tắc). */
function readSignature(
  r: Reader,
  raw: unknown,
  base: SignatureSpec,
): SignatureSpec {
  const o = r.object(raw, 'spec.signature');
  const enabled = r.boolean(o.enabled, 'spec.signature.enabled');
  if (o.rules === undefined) {
    const legacy = [
      'algorithm',
      'key',
      'input',
      'template',
      'name',
      'apply',
    ].some((field) => o[field] !== undefined);
    return {
      enabled,
      rules: legacy
        ? [readSignatureRule(r, o, 'spec.signature')]
        : base.rules.map((rule) => ({ ...rule })),
    };
  }
  const rules = r.list(o.rules, 'spec.signature.rules', (item, at) =>
    readSignatureRule(r, item, at),
  );
  if (rules.length > MAX_SIGNATURE_RULES) {
    r.issues.push(`spec.signature.rules tối đa ${MAX_SIGNATURE_RULES} quy tắc`);
  }
  return { enabled, rules: rules.slice(0, MAX_SIGNATURE_RULES) };
}

function readPackages(
  r: Reader,
  raw: unknown,
  base: PackagesSpec,
): PackagesSpec {
  const o = r.object(raw, 'spec.packages');
  return {
    enabled: r.boolean(o.enabled, 'spec.packages.enabled'),
    request: r.request(o.request, 'spec.packages.request', base.request),
    success: r.conditions(o.success, 'spec.packages.success', base.success),
    listPath: r.string(o.listPath, 'spec.packages.listPath'),
    code: r.string(o.code, 'spec.packages.code'),
    name: r.string(o.name, 'spec.packages.name'),
    price: r.string(o.price, 'spec.packages.price'),
    description: r.string(o.description, 'spec.packages.description'),
  };
}

function readCheck(r: Reader, raw: unknown, base: CheckSpec): CheckSpec {
  const o = r.object(raw, 'spec.check');
  return {
    enabled: r.boolean(o.enabled, 'spec.check.enabled'),
    beforeSubmit: r.boolean(o.beforeSubmit, 'spec.check.beforeSubmit'),
    request: r.request(o.request, 'spec.check.request', base.request),
    eligible: r.list(o.eligible, 'spec.check.eligible', r.condition),
    ineligible: r.list(o.ineligible, 'spec.check.ineligible', r.condition),
    reasonCode: r.string(o.reasonCode, 'spec.check.reasonCode'),
    reasonMessage: r.string(
      o.reasonMessage,
      'spec.check.reasonMessage',
      base.reasonMessage,
    ),
    errorCodePrefix: r.string(o.errorCodePrefix, 'spec.check.errorCodePrefix'),
  };
}

function readOrders(r: Reader, raw: unknown, base: OrdersSpec): OrdersSpec {
  const o = r.object(raw, 'spec.orders');
  return {
    enabled: r.boolean(o.enabled, 'spec.orders.enabled'),
    request: r.request(o.request, 'spec.orders.request', base.request),
    success: r.conditions(o.success, 'spec.orders.success', base.success),
    listPath: r.string(o.listPath, 'spec.orders.listPath'),
    matchBy: r.oneOf(o.matchBy, MATCH_BY, 'spec.orders.matchBy', base.matchBy),
    matchField: r.string(o.matchField, 'spec.orders.matchField'),
    createdAt: r.string(o.createdAt, 'spec.orders.createdAt'),
  };
}

/**
 * Bản cũ: tra cứu kiểu "phản hồi là danh sách" (query.list). Nay là API danh sách đơn
 * (spec.orders) + tra cứu bằng danh sách đơn; tự chuyển để bản đã lưu vẫn chạy.
 */
function readQueryAndOrders(
  r: Reader,
  rawQuery: unknown,
  rawOrders: unknown,
  base: IntegrationSpec,
): { query: QuerySpec; orders: OrdersSpec } {
  const query = r.object(rawQuery, 'spec.query');
  const request = r.request(
    query.request,
    'spec.query.request',
    base.query.request,
  );
  const success = r.conditions(
    query.success,
    'spec.query.success',
    base.query.success,
  );
  const orderPath = r.string(query.orderPath, 'spec.query.orderPath');
  const matchField = r.string(query.matchField, 'spec.query.matchField');
  const legacyList = query.list === true && rawOrders === undefined;
  const orders = legacyList
    ? {
        enabled: true,
        request,
        success,
        listPath: orderPath,
        matchBy: 'TRANS_CODE' as const,
        matchField,
        createdAt: '',
      }
    : readOrders(r, rawOrders, base.orders);
  return {
    query: {
      source: legacyList
        ? 'ORDERS'
        : r.oneOf(
            query.source,
            QUERY_SOURCES,
            'spec.query.source',
            base.query.source,
          ),
      request,
      success,
      orderPath: legacyList ? '' : orderPath,
      matchField: legacyList ? '' : matchField,
      messagePath: r.string(
        query.messagePath,
        'spec.query.messagePath',
        base.query.messagePath,
      ),
      notFound: r.list(query.notFound, 'spec.query.notFound', r.condition),
    },
    orders,
  };
}

function readFields(
  r: Reader,
  raw: unknown,
  base: OrderFieldRules,
): OrderFieldRules {
  const o = r.object(raw, 'spec.fields');
  return Object.fromEntries(
    ORDER_ACTION_VALUES.map((action) => {
      const item = r.object(o[action], `spec.fields.${action}`);
      return [
        action,
        {
          phone: r.oneOf(
            item.phone,
            FIELD_RULES,
            `spec.fields.${action}.phone`,
            base[action].phone,
          ),
          serial: r.oneOf(
            item.serial,
            FIELD_RULES,
            `spec.fields.${action}.serial`,
            base[action].serial,
          ),
        },
      ];
    }),
  ) as OrderFieldRules;
}

function readExtraFields(r: Reader, raw: unknown): OrderExtraField[] {
  const fields = r.list(raw, 'spec.extraFields', (item, at) => {
    const o = r.object(item, at);
    const key = r.string(o.key, `${at}.key`).trim();
    if (!EXTRA_FIELD_KEY.test(key)) {
      r.issues.push(
        `${at}.key phải bắt đầu bằng chữ, chỉ gồm chữ, số, gạch dưới (tối đa 40 ký tự)`,
      );
    }
    return {
      key,
      label: r.string(o.label, `${at}.label`).slice(0, 100),
      type: r.oneOf(o.type, EXTRA_FIELD_TYPES, `${at}.type`, 'TEXT'),
      required: r.boolean(o.required, `${at}.required`),
      actions: [
        ...new Set(
          r.list(o.actions, `${at}.actions`, (action, path) =>
            r.oneOf(action, ORDER_ACTION_VALUES, path, 'BUY_DATA'),
          ),
        ),
      ],
      description: r.string(o.description, `${at}.description`).slice(0, 300),
    };
  });
  if (fields.length > MAX_EXTRA_FIELDS) {
    r.issues.push(`spec.extraFields tối đa ${MAX_EXTRA_FIELDS} trường`);
  }
  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field.key)) {
      r.issues.push(`spec.extraFields: trùng tên trường ${field.key}`);
    }
    seen.add(field.key);
  }
  return fields.slice(0, MAX_EXTRA_FIELDS);
}

function readRule(r: Reader, raw: unknown, path: string): Rule {
  const o = r.object(raw, path);
  return {
    name: r.string(o.name, `${path}.name`),
    conditions: r.list(o.conditions, `${path}.conditions`, r.condition),
    outcome: r.oneOf(o.outcome, RULE_OUTCOMES, `${path}.outcome`, 'UNKNOWN'),
    errorCode: r.string(o.errorCode, `${path}.errorCode`),
  };
}

function readOrder(r: Reader, raw: unknown): OrderMapping {
  const o = r.object(raw, 'spec.order');
  const delivery = r.object(o.delivery, 'spec.order.delivery');
  return {
    status: r.string(o.status, 'spec.order.status'),
    statusMap: r.list(
      o.statusMap,
      'spec.order.statusMap',
      (item, at): StatusMapping => {
        const m = r.object(item, at);
        return {
          value: r.string(m.value, `${at}.value`),
          outcome: r.oneOf(
            m.outcome,
            ORDER_OUTCOMES,
            `${at}.outcome`,
            'PENDING',
          ),
          errorCode: r.string(m.errorCode, `${at}.errorCode`),
        };
      },
    ),
    supplierTransId: r.string(o.supplierTransId, 'spec.order.supplierTransId'),
    errorCode: r.string(o.errorCode, 'spec.order.errorCode'),
    errorCodePrefix: r.string(o.errorCodePrefix, 'spec.order.errorCodePrefix'),
    errorMessage: r.string(o.errorMessage, 'spec.order.errorMessage'),
    delivery: {
      msisdn: r.string(delivery.msisdn, 'spec.order.delivery.msisdn'),
      serial: r.string(delivery.serial, 'spec.order.delivery.serial'),
      lpa: r.string(delivery.lpa, 'spec.order.delivery.lpa'),
      qrUrl: r.string(delivery.qrUrl, 'spec.order.delivery.qrUrl'),
    },
  };
}

function readCallback(r: Reader, raw: unknown): CallbackSpec {
  const o = r.object(raw, 'spec.callback');
  return {
    enabled: r.boolean(o.enabled, 'spec.callback.enabled'),
    eventId: r.string(o.eventId, 'spec.callback.eventId'),
    transCode: r.string(o.transCode, 'spec.callback.transCode'),
    orderPath: r.string(o.orderPath, 'spec.callback.orderPath'),
    accept: r.list(o.accept, 'spec.callback.accept', r.condition),
  };
}

function readSpec(r: Reader, raw: unknown): IntegrationSpec {
  const base = defaultSpec();
  const o = r.object(raw, 'spec');
  const submit = r.object(o.submit, 'spec.submit');
  const test = r.object(o.test, 'spec.test');
  const { query, orders } = readQueryAndOrders(r, o.query, o.orders, base);
  const actions =
    o.actions === undefined
      ? base.actions
      : r.list(o.actions, 'spec.actions', (item, at) =>
          r.oneOf(item, ORDER_ACTION_VALUES, at, 'BUY_DATA'),
        );

  return {
    actions: [...new Set<OrderActionType>(actions)],
    fields: readFields(r, o.fields, base.fields),
    extraFields: readExtraFields(r, o.extraFields),
    auth: readAuth(r, o.auth),
    token: readToken(r, o.token, base.token),
    signature: readSignature(r, o.signature, base.signature),
    headers: r.list(o.headers, 'spec.headers', r.keyValue),
    packages: readPackages(r, o.packages, base.packages),
    check: readCheck(r, o.check, base.check),
    submit: {
      resultMode: r.oneOf(
        submit.resultMode,
        RESULT_MODES,
        'spec.submit.resultMode',
        base.submit.resultMode,
      ),
      request: r.request(
        submit.request,
        'spec.submit.request',
        base.submit.request,
      ),
      success: r.conditions(
        submit.success,
        'spec.submit.success',
        base.submit.success,
      ),
      orderPath: r.string(submit.orderPath, 'spec.submit.orderPath'),
      messagePath: r.string(
        submit.messagePath,
        'spec.submit.messagePath',
        base.submit.messagePath,
      ),
      rules: r.list(submit.rules, 'spec.submit.rules', (item, at) =>
        readRule(r, item, at),
      ),
    },
    query,
    orders,
    order: readOrder(r, o.order),
    test: {
      request: r.request(test.request, 'spec.test.request', base.test.request),
      success: r.conditions(
        test.success,
        'spec.test.success',
        base.test.success,
      ),
    },
    callback: readCallback(r, o.callback),
  };
}

function readNames(r: Reader, raw: unknown, path: string): string[] {
  const names = r.list(raw, path, (item, at) => r.string(item, at));
  for (const name of names) {
    if (!NAME.test(name)) {
      r.issues.push(
        `${path}: tên "${name}" chỉ gồm chữ, số, gạch dưới và bắt đầu bằng chữ`,
      );
    }
  }
  return [...new Set(names)];
}

function readVars(r: Reader, raw: unknown): Record<string, string> {
  const o = r.object(raw, 'vars');
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(o)) {
    if (!NAME.test(key)) {
      r.issues.push(
        `vars: tên "${key}" chỉ gồm chữ, số, gạch dưới và bắt đầu bằng chữ`,
      );
      continue;
    }
    vars[key] = r.string(value, `vars.${key}`);
  }
  return vars;
}

export interface ParsedParams {
  params: HttpConfigParams;
  issues: string[];
}

/** Đọc và chuẩn hoá params; trường thiếu lấy giá trị mặc định. `issues` rỗng mới được lưu. */
export function parseParams(raw: unknown): ParsedParams {
  const r = new Reader();
  const o = r.object(raw, 'params');
  const params: HttpConfigParams = {
    vars: readVars(r, o.vars),
    secretKeys: readNames(r, o.secretKeys, 'secretKeys'),
    spec: readSpec(r, o.spec),
  };
  return { params, issues: r.issues };
}

export function validateSecrets(
  secrets: Record<string, unknown>,
  secretKeys: string[],
): string[] {
  const issues: string[] = [];
  for (const [key, value] of Object.entries(secrets)) {
    if (!NAME.test(key)) {
      issues.push(
        `secrets: tên "${key}" chỉ gồm chữ, số, gạch dưới và bắt đầu bằng chữ`,
      );
    }
    if (typeof value !== 'string' || value.length === 0) {
      issues.push(`secrets.${key} phải là chuỗi khác rỗng`);
    }
  }
  const sent = Object.keys(secrets).sort().join(',');
  if (sent !== [...secretKeys].sort().join(',')) {
    issues.push('secretKeys phải liệt kê đúng tên các bí mật được gửi lên');
  }
  return issues;
}

function references(spec: IntegrationSpec): string[] {
  const text = JSON.stringify([
    spec.auth,
    spec.headers,
    spec.submit.request,
    spec.query.source === 'SINGLE' ? spec.query.request : null,
    spec.test.request,
    spec.token.enabled ? spec.token.request : null,
    spec.packages.enabled ? spec.packages.request : null,
    spec.check.enabled ? spec.check.request : null,
    spec.orders.enabled ? spec.orders.request : null,
    spec.signature.enabled
      ? spec.signature.rules.map((rule) => [rule.key, rule.template])
      : null,
  ]);
  const found = new Set<string>();
  for (const match of text.matchAll(REFERENCE)) {
    for (const part of match[1].split('||')) {
      const ref = part.trim();
      if (/^(vars|secrets)\.[A-Za-z0-9_]+$/.test(ref) || ref === 'token') {
        found.add(ref);
      }
    }
  }
  return [...found];
}

/** Ô đường dẫn nhưng người dùng gõ một giá trị (có khoảng trắng, hoặc chỉ là số). */
function looksLikeValue(expression: string): boolean {
  return expression.split('||').some((raw) => {
    const part = raw.trim();
    if (!part || /^'.*'$/.test(part) || /^".*"$/.test(part)) return false;
    return /\s/.test(part) || /^\d+$/.test(part);
  });
}

function shorten(value: string): string {
  return value.length > 40 ? `${value.slice(0, 40)}…` : value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanList(path: string): string {
  return path.trim().replace(/\[\*\]$/, '');
}

/**
 * Ô đọc trong từng đơn/gói nhưng trỏ cố định vào phần tử [n] (vd data.items[0].status), nên Hub chỉ đọc
 * được phần tử đó. Trả dạng đúng với [*] (data.items[*].status), hoặc null nếu không phải trường hợp này.
 */
function fixedIndexFix(path: string, list: string): string | null {
  if (path.includes('[*]')) return null;
  if (list) {
    const match = new RegExp(`^${escapeRegExp(list)}\\[\\d+\\]\\.(.+)$`).exec(
      path,
    );
    return match ? `${list}[*].${match[1]}` : null;
  }
  const first = /\[\d+\]\./.exec(path);
  if (!first) return null;
  const anchor = path.slice(0, first.index);
  if (!anchor.includes('.')) return null;
  return `${anchor}[*].${path.slice(first.index + first[0].length)}`;
}

interface ItemField {
  label: string;
  path: string;
}

/** Các ô đọc trong từng phần tử của một danh sách (đơn hoặc gói). */
function itemFieldIssues(
  group: string,
  listLabel: string,
  declaredList: string,
  listRelevant: boolean,
  fields: ItemField[],
): string[] {
  const issues: string[] = [];
  const declared = cleanList(declaredList);
  const anchors = new Set<string>();
  for (const { label, path } of fields) {
    if (!path) continue;
    if (looksLikeValue(path)) {
      issues.push(
        `${group}: ô ${label} đang là một giá trị ("${shorten(path)}"), cần đường dẫn tới trường`,
      );
      continue;
    }
    const fixed = listRelevant ? fixedIndexFix(path, declared) : null;
    if (fixed) {
      issues.push(
        `${group}: ô ${label} trỏ cố định vào một phần tử (${path}), dùng [*] để đọc mọi phần tử: ${fixed}`,
      );
      continue;
    }
    const anchor = listAnchor(path);
    if (anchor === null) continue;
    anchors.add(anchor);
    if (declared && anchor !== declared) {
      issues.push(
        `${group}: ô ${label} đọc trong danh sách ${anchor}[*] nhưng ${listLabel} là ${declared}`,
      );
    }
  }
  if (!declared && anchors.size > 1) {
    issues.push(
      `${group}: các ô đang dùng nhiều danh sách khác nhau (${[...anchors].join(', ')}), chỉ được một`,
    );
  }
  return issues;
}

function pathIssues(params: HttpConfigParams): string[] {
  const { spec } = params;
  const ordersRelevant = spec.orders.enabled || spec.query.source === 'ORDERS';
  const issues = itemFieldIssues(
    'Trạng thái đơn',
    'Vị trí danh sách đơn',
    ordersRelevant ? spec.orders.listPath : '',
    ordersRelevant,
    [
      { label: 'Trường trạng thái', path: spec.order.status },
      { label: 'Mã đơn phía nhà cung cấp', path: spec.order.supplierTransId },
      { label: 'Mã lỗi của đơn', path: spec.order.errorCode },
      { label: 'Thông báo lỗi của đơn', path: spec.order.errorMessage },
      { label: 'Số thuê bao', path: spec.order.delivery.msisdn },
      { label: 'Serial', path: spec.order.delivery.serial },
      { label: 'Mã LPA', path: spec.order.delivery.lpa },
      { label: 'Link QR', path: spec.order.delivery.qrUrl },
    ],
  );
  for (const entry of spec.order.statusMap) {
    if (/\s/.test(entry.errorCode.trim())) {
      issues.push(
        `Trạng thái đơn: mã lỗi riêng của giá trị "${entry.value}" có khoảng trắng, mã lỗi phải viết liền (vd ANI_SIM_UNAVAILABLE)`,
      );
    }
  }
  if (spec.orders.enabled) {
    issues.push(
      ...itemFieldIssues(
        'Danh sách đơn',
        'Vị trí danh sách đơn',
        spec.orders.listPath,
        true,
        [
          { label: 'Trường so khớp mã đơn', path: spec.orders.matchField },
          { label: 'Thời điểm tạo đơn', path: spec.orders.createdAt },
        ],
      ),
    );
  }
  if (spec.packages.enabled) {
    issues.push(
      ...itemFieldIssues(
        'Danh sách gói',
        'Vị trí danh sách gói',
        spec.packages.listPath,
        true,
        [
          { label: 'Mã gói', path: spec.packages.code },
          { label: 'Tên gói', path: spec.packages.name },
          { label: 'Giá', path: spec.packages.price },
          { label: 'Mô tả', path: spec.packages.description },
        ],
      ),
    );
  }
  return issues;
}

/** Những gì còn thiếu để chạy được. Không chặn lưu; giao diện hiện cảnh báo. */
const EXTRA_REFERENCE = /order\.extra\.([A-Za-z0-9_]+)/g;

/** Cấu hình dùng {{order.extra.X}} mà chưa khai báo X thì Store không gửi được, giá trị luôn rỗng. */
function extraReferenceIssues(spec: IntegrationSpec): string[] {
  const declared = new Set(spec.extraFields.map((field) => field.key));
  const text = JSON.stringify({ ...spec, extraFields: [] });
  const missing = new Set<string>();
  for (const match of text.matchAll(EXTRA_REFERENCE)) {
    if (!declared.has(match[1])) missing.add(match[1]);
  }
  return [...missing].map(
    (key) =>
      `Đang dùng {{order.extra.${key}}} nhưng chưa khai báo trường thêm "${key}" ở mục Thao tác và trường Store phải gửi`,
  );
}

function signatureIssues(spec: IntegrationSpec): string[] {
  const { rules } = spec.signature;
  if (rules.length === 0) {
    return ['Chữ ký: đang bật nhưng chưa có quy tắc nào'];
  }
  const issues: string[] = [];
  const covered = new Set<string>();
  rules.forEach((rule, index) => {
    const label =
      rules.length === 1
        ? 'Chữ ký'
        : `Chữ ký "${rule.label || `quy tắc ${index + 1}`}"`;
    if (!rule.name) {
      issues.push(`${label}: chưa đặt tên trường hoặc header chứa chữ ký`);
    }
    if (rule.algorithm.startsWith('HMAC') && !rule.key) {
      issues.push(`${label}: chưa nhập khoá ký (vd {{secrets.secretKey}})`);
    }
    if (rule.input === 'TEMPLATE' && !rule.template) {
      issues.push(`${label}: chưa nhập chuỗi cần ký`);
    }
    const methods = rule.methods.length ? rule.methods : HTTP_METHODS;
    const slots = CALL_KINDS.filter((kind) => rule.apply[kind]).flatMap(
      (kind) => methods.map((method) => `${kind}:${method}`),
    );
    if (slots.length === 0) {
      issues.push(`${label}: chưa chọn lời gọi nào để ký`);
    } else if (slots.every((slot) => covered.has(slot))) {
      issues.push(
        `${label}: không bao giờ được dùng vì các quy tắc phía trên đã phủ hết lời gọi của nó`,
      );
    }
    slots.forEach((slot) => covered.add(slot));
  });
  return issues;
}

export function readinessIssues(params: HttpConfigParams): string[] {
  const { spec } = params;
  const issues: string[] = [];
  if (spec.actions.length === 0)
    issues.push('Chưa chọn thao tác nhà cung cấp hỗ trợ');
  if (!spec.submit.request.path) issues.push('Chưa nhập đường dẫn gửi đơn');
  if (spec.query.source === 'SINGLE' && !spec.query.request.path) {
    issues.push('Chưa nhập đường dẫn tra cứu đơn');
  }
  if (spec.query.source === 'ORDERS' && !spec.orders.enabled) {
    issues.push('Tra cứu bằng danh sách đơn nhưng chưa bật API danh sách đơn');
  }
  if (!spec.order.status) issues.push('Chưa chọn trường trạng thái của đơn');
  if (!spec.order.statusMap.some((item) => item.outcome === 'SUCCESS')) {
    issues.push('Chưa khai báo giá trị trạng thái nào nghĩa là thành công');
  }
  if (spec.packages.enabled) {
    if (!spec.packages.request.path) {
      issues.push('Danh sách gói: chưa nhập đường dẫn API');
    }
    if (!spec.packages.code) {
      issues.push('Danh sách gói: chưa chọn trường mã gói');
    }
  }
  if (spec.check.enabled) {
    if (!spec.check.request.path) {
      issues.push('Kiểm tra gói: chưa nhập đường dẫn API');
    }
    if (
      spec.check.eligible.length === 0 &&
      spec.check.ineligible.length === 0
    ) {
      issues.push(
        'Kiểm tra gói: chưa khai báo khi nào là đăng ký được / không được',
      );
    }
  }
  if (spec.orders.enabled) {
    if (!spec.orders.request.path) {
      issues.push('Danh sách đơn: chưa nhập đường dẫn API');
    }
    if (spec.orders.matchBy === 'SUPPLIER_ID' && !spec.order.supplierTransId) {
      issues.push(
        'Danh sách đơn: tìm theo mã nhà cung cấp nhưng chưa chọn ô Mã đơn phía nhà cung cấp (mục Trạng thái đơn)',
      );
    }
    if (!spec.orders.matchField) {
      issues.push(
        'Danh sách đơn: chưa chọn trường chứa mã đơn của Hub (so khớp)',
      );
    }
  }
  if (!spec.test.request.path)
    issues.push('Chưa nhập đường dẫn kiểm tra kết nối');
  if (
    spec.callback.enabled &&
    (!spec.callback.eventId || !spec.callback.orderPath)
  ) {
    issues.push('Callback cần trường mã sự kiện và vị trí đơn hàng');
  }
  if (spec.token.enabled) {
    if (!spec.token.request.path) {
      issues.push('Đăng nhập lấy token: chưa nhập đường dẫn đăng nhập');
    }
    if (!spec.token.tokenPath) {
      issues.push('Đăng nhập lấy token: chưa chọn vị trí token trong phản hồi');
    }
  }
  if (spec.signature.enabled) issues.push(...signatureIssues(spec));
  issues.push(...extraReferenceIssues(spec));
  issues.push(...pathIssues(params));
  for (const ref of references(spec)) {
    if (ref === 'token') {
      if (!spec.token.enabled) {
        issues.push('Đang dùng {{token}} nhưng chưa bật Đăng nhập lấy token');
      }
      continue;
    }
    const [scope, name] = ref.split('.');
    if (scope === 'vars' && !(name in params.vars)) {
      issues.push(`Đang dùng biến ${name} nhưng chưa khai báo`);
    }
    if (scope === 'secrets' && !params.secretKeys.includes(name)) {
      issues.push(`Đang dùng bí mật ${name} nhưng chưa khai báo`);
    }
  }
  return issues;
}
