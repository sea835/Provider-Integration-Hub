export const HTTP_METHODS = ["GET", "POST", "PUT"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const BODY_TYPES = ["NONE", "JSON", "FORM"] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const VALUE_TYPES = ["string", "number", "boolean", "array"] as const;
export type ValueType = (typeof VALUE_TYPES)[number];

export const AUTH_TYPES = ["NONE", "HEADER", "BEARER", "BASIC", "QUERY"] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export const OPERATORS = ["IN", "NOT_IN", "EXISTS", "NOT_EXISTS"] as const;
export type Operator = (typeof OPERATORS)[number];

export const ORDER_OUTCOMES = ["SUCCESS", "FAILED", "PENDING"] as const;
export type OrderOutcome = (typeof ORDER_OUTCOMES)[number];

export const RULE_OUTCOMES = ["REJECTED", "CONFIG_ERROR", "UNKNOWN"] as const;
export type RuleOutcome = (typeof RULE_OUTCOMES)[number];

export const INTEGRATION_ACTIONS = ["BUY_DATA", "TOPUP", "ACTIVATE_SIM"] as const;

export const FIELD_RULES = ["REQUIRED", "OPTIONAL"] as const;
export type FieldRule = (typeof FIELD_RULES)[number];

export interface ActionFieldRules {
  phone: FieldRule;
  serial: FieldRule;
}

export const SIGN_ALGORITHMS = ["HMAC_SHA256", "HMAC_SHA512", "HMAC_SHA1", "HMAC_MD5", "SHA256", "MD5"] as const;
export type SignAlgorithm = (typeof SIGN_ALGORITHMS)[number];

export const SIGN_INPUTS = ["BODY", "TEMPLATE"] as const;
export type SignInput = (typeof SIGN_INPUTS)[number];

export const SIGN_ENCODINGS = ["HEX", "HEX_UPPER", "BASE64"] as const;
export type SignEncoding = (typeof SIGN_ENCODINGS)[number];

export const SIGN_TARGETS = ["BODY_FIELD", "HEADER"] as const;
export type SignTarget = (typeof SIGN_TARGETS)[number];

export const CALL_KINDS = ["login", "packages", "check", "balance", "submit", "query", "orders", "test"] as const;
export type CallKind = (typeof CALL_KINDS)[number];

export const QUERY_SOURCES = ["SINGLE", "ORDERS"] as const;
export type QuerySource = (typeof QUERY_SOURCES)[number];

export interface KeyValue {
  name: string;
  value: string;
  omitIfEmpty: boolean;
}

export interface BodyField {
  key: string;
  value: string;
  type: ValueType;
  omitIfEmpty: boolean;
}

export interface HostSpec {
  key: string;
  label: string;
  url: string;
}

export const MAX_HOSTS = 10;

export interface RequestSpec {
  host: string;
  method: HttpMethod;
  path: string;
  query: KeyValue[];
  bodyType: BodyType;
  body: BodyField[];
}

export interface Condition {
  path: string;
  operator: Operator;
  values: string[];
}

export interface Rule {
  name: string;
  conditions: Condition[];
  outcome: RuleOutcome;
  errorCode: string;
}

export interface StatusMapping {
  value: string;
  outcome: OrderOutcome;
  errorCode: string;
}

export interface TokenSpec {
  enabled: boolean;
  request: RequestSpec;
  success: Condition[];
  tokenPath: string;
  expiresInPath: string;
  ttlSec: number;
  refreshOn: Condition[];
}

export interface SignatureRule {
  label: string;
  methods: HttpMethod[];
  algorithm: SignAlgorithm;
  key: string;
  input: SignInput;
  template: string;
  encoding: SignEncoding;
  target: SignTarget;
  name: string;
  apply: Record<CallKind, boolean>;
}

export interface SignatureSpec {
  enabled: boolean;
  rules: SignatureRule[];
}

export const MAX_SIGNATURE_RULES = 10;

export interface PackagesSpec {
  enabled: boolean;
  request: RequestSpec;
  success: Condition[];
  listPath: string;
  code: string;
  name: string;
  price: string;
  description: string;
}

export const CHECK_MODES = ["DIRECT", "LIST"] as const;
export type CheckMode = (typeof CHECK_MODES)[number];

export interface CheckSpec {
  enabled: boolean;
  beforeSubmit: boolean;
  mode: CheckMode;
  request: RequestSpec;
  eligible: Condition[];
  ineligible: Condition[];
  success: Condition[];
  listPath: string;
  matchField: string;
  matchValue: string;
  ignoreCase: boolean;
  reasonCode: string;
  reasonMessage: string;
  errorCodePrefix: string;
}

export interface BalanceSpec {
  enabled: boolean;
  beforeSubmit: boolean;
  request: RequestSpec;
  success: Condition[];
  available: string;
  pending: string;
  currency: string;
  minimum: string;
}

export const RESULT_MODES = ["POLL", "SYNC"] as const;
export type ResultMode = (typeof RESULT_MODES)[number];

export const MATCH_BY = ["TRANS_CODE", "SUPPLIER_ID"] as const;
export type MatchBy = (typeof MATCH_BY)[number];

export interface OrdersSpec {
  enabled: boolean;
  request: RequestSpec;
  success: Condition[];
  listPath: string;
  matchBy: MatchBy;
  matchField: string;
  createdAt: string;
}

export interface IntegrationSpec {
  actions: string[];
  fields: Record<string, ActionFieldRules>;
  extraFields: ExtraField[];
  hosts: HostSpec[];
  auth: { type: AuthType; name: string; value: string; username: string; password: string };
  token: TokenSpec;
  signature: SignatureSpec;
  headers: KeyValue[];
  packages: PackagesSpec;
  check: CheckSpec;
  balance: BalanceSpec;
  submit: {
    resultMode: ResultMode;
    request: RequestSpec;
    success: Condition[];
    orderPath: string;
    messagePath: string;
    rules: Rule[];
  };
  query: {
    source: QuerySource;
    request: RequestSpec;
    success: Condition[];
    orderPath: string;
    matchField: string;
    messagePath: string;
    notFound: Condition[];
  };
  orders: OrdersSpec;
  order: {
    status: string;
    statusMap: StatusMapping[];
    supplierTransId: string;
    errorCode: string;
    errorCodePrefix: string;
    errorMessage: string;
    delivery: { msisdn: string; serial: string; lpa: string; qrUrl: string };
  };
  test: { request: RequestSpec; success: Condition[] };
  callback: { enabled: boolean; eventId: string; transCode: string; orderPath: string; accept: Condition[] };
}

export interface IntegrationParams {
  vars: Record<string, string>;
  secretKeys: string[];
  spec: IntegrationSpec;
}

export type PathMode = "response" | "body" | "list" | "order" | "callback";

export const EXTRA_FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "TEXT_LIST"] as const;
export type ExtraFieldType = (typeof EXTRA_FIELD_TYPES)[number];
export const MAX_EXTRA_FIELDS = 20;

export interface ExtraField {
  key: string;
  label: string;
  type: ExtraFieldType;
  required: boolean;
  actions: string[];
  options: string[];
  description: string;
}
