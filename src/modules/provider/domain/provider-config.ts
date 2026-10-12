/**
 * Cấu hình gọi API số dư do người dùng khai báo trên giao diện, lưu ở `providers.config`.
 * Bí mật (mật khẩu, API key...) không nằm ở đây mà ở `providers.encrypted_secrets`.
 * Biến dùng trong mẫu: {{vars.*}}, {{secrets.*}}, {{token}}, {{now.*}}, {{uuid}};
 * khi đọc phản hồi: {{http.status}}, {{body.*}}, {{headers.*}}.
 */
export const HTTP_METHODS = ['GET', 'POST', 'PUT'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const BODY_TYPES = ['NONE', 'JSON', 'FORM'] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const VALUE_TYPES = ['string', 'number', 'boolean'] as const;
export type ValueType = (typeof VALUE_TYPES)[number];

export const AUTH_TYPES = [
  'NONE',
  'HEADER',
  'BEARER',
  'BASIC',
  'QUERY',
] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export const OPERATORS = ['IN', 'NOT_IN', 'EXISTS', 'NOT_EXISTS'] as const;
export type Operator = (typeof OPERATORS)[number];

export const SIGN_ALGORITHMS = [
  'HMAC_SHA256',
  'HMAC_SHA512',
  'HMAC_SHA1',
  'HMAC_MD5',
  'SHA256',
  'MD5',
] as const;
export type SignAlgorithm = (typeof SIGN_ALGORITHMS)[number];

/** BODY: ký trên body thô (chưa có trường chữ ký). TEMPLATE: ký trên chuỗi tự ghép. */
export const SIGN_INPUTS = ['BODY', 'TEMPLATE'] as const;
export type SignInput = (typeof SIGN_INPUTS)[number];

export const SIGN_ENCODINGS = ['HEX', 'HEX_UPPER', 'BASE64'] as const;
export type SignEncoding = (typeof SIGN_ENCODINGS)[number];

/** BODY_FIELD: thêm vào body (request không có body thì thêm vào URL). HEADER: thêm header. */
export const SIGN_TARGETS = ['BODY_FIELD', 'HEADER'] as const;
export type SignTarget = (typeof SIGN_TARGETS)[number];

export const CALL_KINDS = ['login', 'balance'] as const;
export type CallKind = (typeof CALL_KINDS)[number];

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

/**
 * Base URL có tên, dùng khi đối tác có nhiều máy chủ (vd đăng nhập và số dư ở hai địa chỉ).
 * Mỗi request chọn theo `key`; đổi môi trường chỉ cần sửa `url` ở một chỗ.
 */
export interface HostSpec {
  key: string;
  label: string;
  url: string;
}

export const HOST_KEY = /^[A-Za-z][A-Za-z0-9_]{0,29}$/;
export const MAX_HOSTS = 10;

export interface RequestSpec {
  /** Rỗng = Base URL mặc định; có giá trị = `key` của một địa chỉ trong `config.hosts`. */
  host: string;
  method: HttpMethod;
  /** Đường dẫn nối sau Base URL đã chọn; ghi đủ `https://...` thì gọi thẳng. */
  path: string;
  query: KeyValue[];
  bodyType: BodyType;
  body: BodyField[];
}

/** So sánh dạng chuỗi. Giá trị `2xx`, `4xx`... khớp theo chữ số đầu của HTTP status. */
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

/**
 * Đăng nhập lấy token: Hub tự gọi, lưu dùng chung, tự lấy lại khi hết hạn hoặc khi đối tác báo token sai.
 * `refreshOn`: chỉ cần MỘT điều kiện đúng là lấy token mới.
 */
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
  apply: Record<CallKind, boolean>;
}

export interface BalanceSpec {
  request: RequestSpec;
  success: Condition[];
  /** Đường dẫn tới số dư trong phản hồi, vd `body.data.balance`. */
  balancePath: string;
  /** Đường dẫn mã lỗi / thông điệp của đối tác, dùng khi lời gọi không thành công. */
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
  /** Base URL mặc định, dùng cho request không chọn địa chỉ có tên. */
  baseUrl: string;
  hosts: HostSpec[];
  vars: Record<string, string>;
  spec: IntegrationSpec;
}

/**
 * Phản hồi mẫu của một lời gọi (đã che bí mật), lưu lại để người cấu hình bấm chọn trường
 * thay vì gõ tay đường dẫn. Không tham gia vào việc gọi API.
 */
export interface ResponseSample {
  httpStatus: number;
  body: unknown;
  capturedAt: string;
}

export type ProviderSamples = Partial<Record<CallKind, ResponseSample>>;

const emptyRequest = (method: HttpMethod): RequestSpec => ({
  host: '',
  method,
  path: '',
  query: [],
  bodyType: method === 'GET' ? 'NONE' : 'JSON',
  body: [],
});

export const http2xx = (): Condition => ({
  path: 'http.status',
  operator: 'IN',
  values: ['2xx'],
});

export function defaultSpec(): IntegrationSpec {
  return {
    auth: { type: 'NONE', name: '', value: '', username: '', password: '' },
    token: {
      enabled: false,
      request: emptyRequest('POST'),
      success: [http2xx()],
      tokenPath: '',
      expiresInPath: '',
      ttlSec: 3600,
      refreshOn: [{ path: 'http.status', operator: 'IN', values: ['401'] }],
    },
    signature: {
      enabled: false,
      algorithm: 'HMAC_SHA256',
      key: '',
      input: 'BODY',
      template: '',
      encoding: 'HEX',
      target: 'HEADER',
      name: 'X-Signature',
      apply: { login: false, balance: true },
    },
    headers: [],
    balance: {
      request: emptyRequest('GET'),
      success: [http2xx()],
      balancePath: '',
      errorCodePath: '',
      errorMessagePath: 'body.message',
    },
  };
}

export function defaultProviderConfig(): ProviderConfig {
  return { baseUrl: '', hosts: [], vars: {}, spec: defaultSpec() };
}
