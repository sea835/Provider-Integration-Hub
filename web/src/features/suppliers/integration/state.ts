import type { Condition, ExtraField, IntegrationParams, IntegrationSpec, RequestSpec, SignatureRule } from "./types";

type Plain = Record<string, unknown>;

function isPlain(value: unknown): value is Plain {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDefaults(base: unknown, value: unknown): unknown {
  if (value === undefined || value === null) return base;
  if (Array.isArray(base)) return Array.isArray(value) ? value : base;
  if (isPlain(base)) {
    if (!isPlain(value)) return base;
    const merged: Plain = { ...value };
    for (const [key, item] of Object.entries(base)) merged[key] = mergeDefaults(item, value[key]);
    return merged;
  }
  return typeof value === typeof base ? value : base;
}

const request = (method: RequestSpec["method"]): RequestSpec => ({
  host: "",
  method,
  path: "",
  query: [],
  bodyType: method === "GET" ? "NONE" : "JSON",
  body: [],
});

const http2xx = (): Condition => ({ path: "http.status", operator: "IN", values: ["2xx"] });

export function emptySignatureRule(label = "Chữ ký"): SignatureRule {
  return {
    label,
    methods: [],
    algorithm: "HMAC_SHA256",
    key: "",
    input: "BODY",
    template: "",
    encoding: "HEX",
    target: "BODY_FIELD",
    name: "signature",
    apply: {
      login: false,
      packages: false,
      check: false,
      balance: false,
      submit: true,
      query: false,
      orders: false,
      test: false,
    },
  };
}

export function emptySpec(): IntegrationSpec {
  return {
    actions: ["BUY_DATA", "TOPUP", "ACTIVATE_SIM"],
    fields: {
      BUY_DATA: { phone: "REQUIRED", serial: "OPTIONAL" },
      TOPUP: { phone: "REQUIRED", serial: "OPTIONAL" },
      ACTIVATE_SIM: { phone: "OPTIONAL", serial: "OPTIONAL" },
      CANCEL_PACKAGE: { phone: "OPTIONAL", serial: "OPTIONAL" },
    },
    extraFields: [],
    hosts: [],
    auth: { type: "NONE", name: "", value: "", username: "", password: "" },
    token: {
      enabled: false,
      request: request("POST"),
      success: [http2xx()],
      tokenPath: "",
      expiresInPath: "",
      ttlSec: 3600,
      refreshOn: [{ path: "http.status", operator: "IN", values: ["401"] }],
    },
    signature: { enabled: false, rules: [emptySignatureRule()] },
    headers: [],
    packages: {
      enabled: false,
      request: request("GET"),
      success: [http2xx()],
      listPath: "",
      code: "",
      name: "",
      price: "",
      description: "",
    },
    check: {
      enabled: false,
      beforeSubmit: false,
      mode: "DIRECT",
      request: request("GET"),
      eligible: [],
      ineligible: [],
      success: [http2xx()],
      listPath: "",
      matchField: "",
      matchValue: "{{order.packageCode}}",
      ignoreCase: false,
      reasonCode: "",
      reasonMessage: "body.message",
      errorCodePrefix: "",
    },
    balance: {
      enabled: false,
      beforeSubmit: false,
      request: request("GET"),
      success: [http2xx()],
      available: "",
      pending: "",
      currency: "",
      minimum: "",
    },
    submit: {
      resultMode: "SYNC",
      request: request("POST"),
      success: [http2xx()],
      orderPath: "",
      messagePath: "body.message",
      rules: [],
    },
    query: {
      source: "SINGLE",
      request: request("GET"),
      success: [http2xx()],
      orderPath: "",
      matchField: "",
      messagePath: "body.message",
      notFound: [],
    },
    orders: {
      enabled: false,
      request: request("GET"),
      success: [http2xx()],
      listPath: "",
      matchBy: "TRANS_CODE",
      matchField: "",
      createdAt: "",
    },
    order: {
      status: "",
      statusMap: [],
      supplierTransId: "",
      errorCode: "",
      errorCodePrefix: "",
      errorMessage: "",
      delivery: { msisdn: "", serial: "", lpa: "", qrUrl: "" },
    },
    test: { request: request("GET"), success: [http2xx()] },
    callback: { enabled: false, eventId: "", transCode: "", orderPath: "", accept: [] },
  };
}

function migrateLegacyQuery(spec: unknown): unknown {
  if (!isPlain(spec) || !isPlain(spec.query) || spec.query.list !== true || spec.orders !== undefined) return spec;
  const query = spec.query;
  return {
    ...spec,
    query: { ...query, source: "ORDERS", orderPath: "", matchField: "", list: undefined },
    orders: {
      enabled: true,
      request: query.request,
      success: query.success,
      listPath: query.orderPath ?? "",
      matchBy: "TRANS_CODE",
      matchField: query.matchField ?? "",
      createdAt: "",
    },
  };
}

const LEGACY_SIGNATURE_FIELDS = ["algorithm", "key", "input", "template", "name", "apply"];

function migrateSignature(spec: unknown): unknown {
  if (!isPlain(spec) || !isPlain(spec.signature)) return spec;
  const signature = spec.signature;
  const legacy = signature.rules === undefined && LEGACY_SIGNATURE_FIELDS.some((field) => field in signature);
  const rawRules = Array.isArray(signature.rules) ? signature.rules : legacy ? [signature] : [emptySignatureRule()];
  const rules = rawRules.map((rule) => {
    const merged = mergeDefaults(emptySignatureRule(), rule) as SignatureRule & { enabled?: unknown };
    delete merged.enabled;
    return merged;
  });
  return { ...spec, signature: { enabled: signature.enabled === true, rules } };
}

export function emptyExtraField(): ExtraField {
  return { key: "", label: "", type: "TEXT", required: false, actions: [], options: [], description: "" };
}

function migrateExtraFields(spec: unknown): unknown {
  if (!isPlain(spec)) return spec;
  return {
    ...spec,
    ...(Array.isArray(spec.extraFields)
      ? { extraFields: spec.extraFields.filter(isPlain).map((field) => mergeDefaults(emptyExtraField(), field)) }
      : {}),
    ...(Array.isArray(spec.hosts)
      ? { hosts: spec.hosts.filter(isPlain).map((host) => mergeDefaults({ key: "", label: "", url: "" }, host)) }
      : {}),
  };
}

export function toIntegrationParams(raw: unknown): IntegrationParams {
  const source = isPlain(raw) ? raw : {};
  const vars = isPlain(source.vars)
    ? Object.fromEntries(Object.entries(source.vars).map(([key, value]) => [key, String(value ?? "")]))
    : {};
  const secretKeys = Array.isArray(source.secretKeys) ? source.secretKeys.map(String) : [];
  const spec = mergeDefaults(
    emptySpec(),
    migrateExtraFields(migrateSignature(migrateLegacyQuery(source.spec))),
  ) as IntegrationSpec & {
    query: { list?: unknown };
  };
  delete spec.query.list;
  return { vars, secretKeys, spec };
}

export type Path = Array<string | number>;

export function setIn<T>(target: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  if (Array.isArray(target)) {
    const copy = [...target] as unknown[];
    copy[head as number] = setIn(copy[head as number], rest, value);
    return copy as T;
  }
  const source = (isPlain(target) ? target : {}) as Plain;
  return { ...source, [head]: setIn(source[head as string], rest, value) } as T;
}

export function getIn(target: unknown, path: Path): unknown {
  return path.reduce<unknown>((current, key) => {
    if (Array.isArray(current)) return current[key as number];
    if (isPlain(current)) return current[key as string];
    return undefined;
  }, target);
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface OrderPick {
  value: string;
  container: string | null;
  viaIndex: boolean;
}

function cleanBase(raw: string): string {
  return raw.trim().replace(/^body\./, "");
}

export function relativeToOrder(absolute: string, containers: string[]): OrderPick {
  const bases = containers
    .map(cleanBase)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const base of bases) {
    const match = new RegExp(`^${escape(base)}(\\[\\d+\\])?\\.(.+)$`).exec(absolute);
    if (!match) continue;
    return match[1]
      ? { value: `${base}[*].${match[2]}`, container: base, viaIndex: true }
      : { value: match[2], container: base, viaIndex: false };
  }
  const first = /\[\d+\]\./.exec(absolute);
  if (first) {
    const container = absolute.slice(0, first.index);
    return {
      value: `${container}[*].${absolute.slice(first.index + first[0].length)}`,
      container,
      viaIndex: true,
    };
  }
  return { value: absolute, container: null, viaIndex: false };
}

export function listLocation(absolute: string): string {
  const last = [...absolute.matchAll(/\[\d+\]/g)].pop();
  return last?.index !== undefined ? absolute.slice(0, last.index) : absolute;
}

export function hasFixedIndex(path: string): boolean {
  return !path.includes("[*]") && /\[\d+\]\./.test(path);
}

export function sameBase(a: string, b: string): boolean {
  return cleanBase(a) === cleanBase(b);
}

export function isBlankBase(raw: string): boolean {
  return cleanBase(raw) === "";
}

export function looksLikeValue(expression: string): boolean {
  return expression.split("||").some((raw) => {
    const part = raw.trim();
    if (!part || /^'.*'$/.test(part) || /^".*"$/.test(part)) return false;
    return /\s/.test(part) || /^\d+$/.test(part);
  });
}
