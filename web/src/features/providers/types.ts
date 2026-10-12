export const HTTP_METHODS = ["GET", "POST", "PUT"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const BODY_TYPES = ["NONE", "JSON", "FORM"] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const VALUE_TYPES = ["string", "number", "boolean"] as const;
export type ValueType = (typeof VALUE_TYPES)[number];

export const AUTH_TYPES = ["NONE", "BEARER", "BASIC", "HEADER", "QUERY"] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export const OPERATORS = ["IN", "NOT_IN", "EXISTS", "NOT_EXISTS"] as const;
export type Operator = (typeof OPERATORS)[number];

export const SIGN_ALGORITHMS = ["HMAC_SHA256", "HMAC_SHA512", "HMAC_SHA1", "HMAC_MD5", "SHA256", "MD5"] as const;
export type SignAlgorithm = (typeof SIGN_ALGORITHMS)[number];

export const SIGN_INPUTS = ["BODY", "TEMPLATE"] as const;
export type SignInput = (typeof SIGN_INPUTS)[number];

export const SIGN_ENCODINGS = ["HEX", "HEX_UPPER", "BASE64"] as const;
export type SignEncoding = (typeof SIGN_ENCODINGS)[number];

export const SIGN_TARGETS = ["HEADER", "BODY_FIELD"] as const;
export type SignTarget = (typeof SIGN_TARGETS)[number];

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

export interface AuthSpec {
  type: AuthType;
  name: string;
  value: string;
  username: string;
  password: string;
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

export interface SignatureSpec {
  enabled: boolean;
  algorithm: SignAlgorithm;
  key: string;
  input: SignInput;
  template: string;
  encoding: SignEncoding;
  target: SignTarget;
  name: string;
  apply: { login: boolean; balance: boolean };
}

export interface BalanceSpec {
  request: RequestSpec;
  success: Condition[];
  balancePath: string;
  errorCodePath: string;
  errorMessagePath: string;
}

export interface IntegrationSpec {
  auth: AuthSpec;
  token: TokenSpec;
  signature: SignatureSpec;
  headers: KeyValue[];
  balance: BalanceSpec;
}

export interface ProviderConfig {
  baseUrl: string;
  hosts: HostSpec[];
  vars: Record<string, string>;
  spec: IntegrationSpec;
}

export interface ResponseSample {
  httpStatus: number;
  body: unknown;
  capturedAt: string;
}

export type CallKind = "login" | "balance";

export type ProviderSamples = Partial<Record<CallKind, ResponseSample>>;

export type ProviderStatus = "ACTIVE" | "PAUSED";
export type AlertLevel = "OK" | "WARNING" | "CRITICAL";
export type CheckStatus = "SUCCESS" | "FAILED";

export interface Provider {
  id: string;
  code: string;
  name: string;
  status: ProviderStatus;
  config: ProviderConfig;
  samples: ProviderSamples;
  secretKeys: string[];
  unitMultiplier: number;
  intervalMinutes: number;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  cooldownMinutes: number;
  currentBalance: number | null;
  level: AlertLevel;
  consecutiveFailures: number;
  connectionFailing: boolean;
  lastCheckedAt: string | null;
  lastStatus: CheckStatus | null;
  readinessIssues: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BalanceCheck {
  id: string;
  providerId: string;
  status: CheckStatus;
  balance: number | null;
  httpStatus: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  checkedAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface BalanceSeries {
  providerId: string;
  points: Array<{ at: string; balance: number }>;
}

export type SeriesRange = "5m" | "15m" | "30m" | "60m" | "3h" | "12h" | "24h" | "7d" | "30d";

export interface ProbeStep {
  kind: "login" | "balance";
  ok: boolean;
  note: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
    signedPayload?: string;
    signature?: string;
  };
  response: {
    status?: number;
    body?: unknown;
    error?: string;
    durationMs: number;
  };
}

export interface TestConnectionResult {
  ok: boolean;
  balance: number | null;
  rawValue: string | null;
  httpStatus: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  tokenPreview: string | null;
  steps: ProbeStep[];
}

export type SecretsPatch = Record<string, string | null>;
