import {
  ORDER_ACTION_VALUES,
  OrderActionType,
} from '@modules/provider-adapter/domain/order-action';
import {
  defaultFieldRules,
  OrderExtraField,
  OrderFieldRules,
} from '@modules/provider-adapter/domain/order-fields';

/**
 * Bản tích hợp do người dùng khai báo trên giao diện cho NCC có API riêng.
 * Lưu trong `suppliers.params`; bí mật (token, API key) nằm ở `secrets` đã mã hoá.
 * Biến trong template: {{order.*}}, {{vars.*}}, {{secrets.*}}, {{now.*}}, {{uuid}} (mới cho mỗi lời gọi),
 * {{token}} (khi bật đăng nhập lấy token), {{range.from.*}} / {{range.to.*}} (API danh sách đơn);
 * khi đọc phản hồi: {{http.status}}, {{body.*}}, {{headers.*}}.
 */
export const HTTP_METHODS = ['GET', 'POST', 'PUT'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const BODY_TYPES = ['NONE', 'JSON', 'FORM'] as const;
export type BodyType = (typeof BODY_TYPES)[number];

/** array: giá trị là danh sách (vd `{{order.extra.iccids}}`); chuỗi "a,b" tách theo dấu phẩy. */
export const VALUE_TYPES = ['string', 'number', 'boolean', 'array'] as const;
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

export const ORDER_OUTCOMES = ['SUCCESS', 'FAILED', 'PENDING'] as const;
export type OrderOutcome = (typeof ORDER_OUTCOMES)[number];

/** REJECTED: NCC từ chối đơn. CONFIG_ERROR: sai khoá/cấu hình. UNKNOWN: chưa chắc, Hub tra cứu tiếp. */
export const RULE_OUTCOMES = ['REJECTED', 'CONFIG_ERROR', 'UNKNOWN'] as const;
export type RuleOutcome = (typeof RULE_OUTCOMES)[number];

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

export const CALL_KINDS = [
  'login',
  'packages',
  'check',
  'balance',
  'submit',
  'query',
  'orders',
  'test',
] as const;
export type CallKind = (typeof CALL_KINDS)[number];

/** SINGLE: API tra cứu từng đơn. ORDERS: tìm đơn trong API danh sách đơn. */
export const QUERY_SOURCES = ['SINGLE', 'ORDERS'] as const;
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

/** Địa chỉ gốc có tên (vd máy chủ thanh toán khác máy chủ tra cứu); API chọn theo `key`. */
export interface HostSpec {
  key: string;
  label: string;
  url: string;
}

export const HOST_KEY = /^[A-Za-z][A-Za-z0-9_]{0,29}$/;
export const MAX_HOSTS = 10;

export interface RequestSpec {
  /** Rỗng = Base URL của NCC; có giá trị = `key` của một địa chỉ trong `spec.hosts`. */
  host?: string;
  method: HttpMethod;
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

export interface Rule {
  name: string;
  conditions: Condition[];
  outcome: RuleOutcome;
  errorCode: string;
}

export interface AuthSpec {
  type: AuthType;
  name: string;
  value: string;
  username: string;
  password: string;
}

export interface StatusMapping {
  value: string;
  outcome: OrderOutcome;
  errorCode: string;
}

/** Đọc một đơn hàng của NCC. Mọi đường dẫn tính từ chính đối tượng đơn. */
export interface OrderMapping {
  status: string;
  statusMap: StatusMapping[];
  supplierTransId: string;
  errorCode: string;
  errorCodePrefix: string;
  errorMessage: string;
  delivery: { msisdn: string; serial: string; lpa: string; qrUrl: string };
}

/**
 * POLL: phản hồi tạo đơn chỉ xác nhận đã nhận; Hub luôn coi là đang xử lý rồi tra cứu (API 4/5).
 * SYNC: phản hồi tạo đơn đã có kết quả; Hub đọc trạng thái ngay, chưa xong thì mới tra cứu.
 */
export const RESULT_MODES = ['POLL', 'SYNC'] as const;
export type ResultMode = (typeof RESULT_MODES)[number];

/** Tìm đơn trong danh sách theo mã đơn Hub, hoặc theo mã đơn NCC đã lưu lúc tạo (thiếu thì dùng mã Hub). */
export const MATCH_BY = ['TRANS_CODE', 'SUPPLIER_ID'] as const;
export type MatchBy = (typeof MATCH_BY)[number];

export interface SubmitSpec {
  resultMode: ResultMode;
  request: RequestSpec;
  success: Condition[];
  orderPath: string;
  messagePath: string;
  rules: Rule[];
}

export interface QuerySpec {
  source: QuerySource;
  request: RequestSpec;
  success: Condition[];
  orderPath: string;
  /** Trường chứa mã đơn Hub trong đơn trả về; có thì Hub kiểm tra khớp. */
  matchField: string;
  messagePath: string;
  notFound: Condition[];
}

/** API 1: danh sách gói. Đường dẫn trường tính từ một phần tử của danh sách. */
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

/**
 * API 2: kiểm tra gói có đăng ký được không. Khớp `eligible` → được; khớp `ineligible` → không được;
 * còn lại (kể cả lỗi mạng) là chưa rõ và Hub vẫn gửi đơn.
 */
/**
 * DIRECT: phản hồi nói thẳng đăng ký được hay không (theo điều kiện).
 * LIST: phản hồi là danh sách gói thuê bao đăng ký được; có gói của đơn trong danh sách là được.
 */
export const CHECK_MODES = ['DIRECT', 'LIST'] as const;
export type CheckMode = (typeof CHECK_MODES)[number];

export interface CheckSpec {
  enabled: boolean;
  beforeSubmit: boolean;
  mode: CheckMode;
  request: RequestSpec;
  eligible: Condition[];
  ineligible: Condition[];
  /** LIST: lời gọi hợp lệ khi; không khớp thì chưa rõ (Hub vẫn gửi đơn). */
  success: Condition[];
  /** LIST: vị trí danh sách; trống thì lấy theo ô matchField dạng `data.items[*].code`. */
  listPath: string;
  /** LIST: trường trong mỗi phần tử để so (mã hoặc tên gói). */
  matchField: string;
  /** LIST: giá trị của đơn đem dò, mặc định `{{order.packageCode}}`. */
  matchValue: string;
  ignoreCase: boolean;
  reasonCode: string;
  reasonMessage: string;
  errorCodePrefix: string;
}

/**
 * Số dư tài khoản đại lý tại NCC (vd MoMo B2B). `beforeSubmit`: kiểm tra trước lần gửi đầu,
 * dưới mức tối thiểu thì đơn thất bại ngay, không gửi; API số dư lỗi thì vẫn gửi.
 */
export interface BalanceSpec {
  enabled: boolean;
  beforeSubmit: boolean;
  request: RequestSpec;
  success: Condition[];
  available: string;
  pending: string;
  currency: string;
  /** Mẫu ra số, vd `100000`, `{{vars.minBalance}}`, `{{order.extra.amount}}`. Trống = cần lớn hơn 0. */
  minimum: string;
}

/** API 5: danh sách đơn phía NCC. Dùng để tra cứu dự phòng và để admin xem. */
export interface OrdersSpec {
  enabled: boolean;
  request: RequestSpec;
  success: Condition[];
  listPath: string;
  matchBy: MatchBy;
  matchField: string;
  createdAt: string;
}

export interface TestSpec {
  request: RequestSpec;
  success: Condition[];
}

export interface CallbackSpec {
  enabled: boolean;
  eventId: string;
  transCode: string;
  orderPath: string;
  accept: Condition[];
}

/**
 * Đăng nhập lấy token: Hub tự gọi, lưu dùng chung, tự lấy lại khi hết hạn hoặc khi NCC báo token sai.
 * `refreshOn`: chỉ cần MỘT điều kiện đúng là lấy token mới (khác các danh sách điều kiện khác).
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

/**
 * Một cách ký. Request dùng quy tắc ĐẦU TIÊN khớp cả lời gọi (apply) lẫn phương thức
 * (methods rỗng = mọi phương thức), nên mỗi API / mỗi phương thức ký theo cách riêng được.
 */
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

export const defaultSignatureRule = (): SignatureRule => ({
  label: 'Chữ ký',
  methods: [],
  algorithm: 'HMAC_SHA256',
  key: '',
  input: 'BODY',
  template: '',
  encoding: 'HEX',
  target: 'BODY_FIELD',
  name: 'signature',
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
});

export interface IntegrationSpec {
  actions: OrderActionType[];
  /** Store bắt buộc gửi SĐT / serial cho từng thao tác. */
  fields: OrderFieldRules;
  /** Trường thêm Store gửi trong `extra` (vd activationDate), dùng qua {{order.extra.<key>}}. */
  extraFields: OrderExtraField[];
  hosts: HostSpec[];
  auth: AuthSpec;
  token: TokenSpec;
  signature: SignatureSpec;
  headers: KeyValue[];
  packages: PackagesSpec;
  check: CheckSpec;
  balance: BalanceSpec;
  submit: SubmitSpec;
  query: QuerySpec;
  orders: OrdersSpec;
  order: OrderMapping;
  test: TestSpec;
  callback: CallbackSpec;
}

export interface HttpConfigParams {
  vars: Record<string, string>;
  secretKeys: string[];
  spec: IntegrationSpec;
}

const emptyRequest = (method: HttpMethod = 'GET'): RequestSpec => ({
  host: '',
  method,
  path: '',
  query: [],
  bodyType: method === 'GET' ? 'NONE' : 'JSON',
  body: [],
});

const http2xx = (): Condition => ({
  path: 'http.status',
  operator: 'IN',
  values: ['2xx'],
});

export function defaultSpec(): IntegrationSpec {
  return {
    actions: [...ORDER_ACTION_VALUES].filter((a) => a !== 'CANCEL_PACKAGE'),
    fields: defaultFieldRules(),
    extraFields: [],
    hosts: [],
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
    signature: { enabled: false, rules: [defaultSignatureRule()] },
    headers: [],
    packages: {
      enabled: false,
      request: emptyRequest('GET'),
      success: [http2xx()],
      listPath: '',
      code: '',
      name: '',
      price: '',
      description: '',
    },
    check: {
      enabled: false,
      beforeSubmit: false,
      mode: 'DIRECT',
      request: emptyRequest('GET'),
      eligible: [],
      ineligible: [],
      success: [http2xx()],
      listPath: '',
      matchField: '',
      matchValue: '{{order.packageCode}}',
      ignoreCase: false,
      reasonCode: '',
      reasonMessage: 'body.message',
      errorCodePrefix: '',
    },
    balance: {
      enabled: false,
      beforeSubmit: false,
      request: emptyRequest('GET'),
      success: [http2xx()],
      available: '',
      pending: '',
      currency: '',
      minimum: '',
    },
    submit: {
      resultMode: 'SYNC',
      request: emptyRequest('POST'),
      success: [http2xx()],
      orderPath: '',
      messagePath: 'body.message',
      rules: [],
    },
    query: {
      source: 'SINGLE',
      request: emptyRequest('GET'),
      success: [http2xx()],
      orderPath: '',
      matchField: '',
      messagePath: 'body.message',
      notFound: [],
    },
    orders: {
      enabled: false,
      request: emptyRequest('GET'),
      success: [http2xx()],
      listPath: '',
      matchBy: 'TRANS_CODE',
      matchField: '',
      createdAt: '',
    },
    order: {
      status: '',
      statusMap: [],
      supplierTransId: '',
      errorCode: '',
      errorCodePrefix: '',
      errorMessage: '',
      delivery: { msisdn: '', serial: '', lpa: '', qrUrl: '' },
    },
    test: { request: emptyRequest('GET'), success: [http2xx()] },
    callback: {
      enabled: false,
      eventId: '',
      transCode: '',
      orderPath: '',
      accept: [],
    },
  };
}

export function defaultParams(): HttpConfigParams {
  return { vars: {}, secretKeys: [], spec: defaultSpec() };
}
