import { OrderActionType } from '@modules/provider-adapter/domain/order-action';
import {
  OrderExtra,
  OrderExtraField,
  OrderFieldRules,
} from '@modules/provider-adapter/domain/order-fields';
import {
  OutcomeType,
  SupplierResult,
  SupplierTrace,
} from '@modules/provider-adapter/domain/supplier-result';

export interface SupplierContext {
  supplierId: string;
  supplierCode: string;
  baseUrl: string;
  secrets: Record<string, unknown>;
  params: Record<string, unknown>;
  timeouts: { submitMs: number; queryMs: number };
  configVersion: number;
}

/** Lệnh đăng ký gửi sang NCC. `packageCode` là mã gói phía NCC do Store chỉ định. */
export interface OrderCommand {
  transCode: string;
  action: OrderActionType;
  packageCode: string;
  phone: string | null;
  serial: string | null;
  /** Trường thêm Store gửi theo khai báo của NCC (đã kiểm tra kiểu). */
  extra?: OrderExtra;
  /** Lần gửi thứ mấy của đơn (1 = lần đầu). */
  attempt?: number;
}

/** Một gói của NCC ở dạng chuẩn Hub trả cho Store. */
export interface SupplierPackage {
  code: string;
  name: string;
  price: number | null;
  description: string | null;
}

export interface PackageFilter {
  action: OrderActionType | null;
  phone: string | null;
  serial: string | null;
  /** Trường thêm Store gửi kèm (vd provider), đã kiểm tra theo khai báo của NCC. */
  extra?: OrderExtra;
}

/** `unsupported`: NCC trả lời rõ là không có API này. */
export type PackageListResult =
  | { ok: true; packages: SupplierPackage[]; trace: SupplierTrace }
  | {
      ok: false;
      message: string;
      unsupported?: boolean;
      trace: SupplierTrace;
    };

export interface PackageCheckCommand {
  action: OrderActionType;
  packageCode: string;
  phone: string | null;
  serial: string | null;
  extra?: OrderExtra;
}

/** eligible = null: chưa rõ (lỗi mạng, NCC không hỗ trợ, phản hồi không đọc được). */
export interface PackageCheckResult {
  eligible: boolean | null;
  reason: { code: string; message: string } | null;
  unsupported?: boolean;
  trace: SupplierTrace;
}

export interface OrderRange {
  from: Date;
  to: Date;
}

/** Một đơn phía NCC (API danh sách đơn), đã đọc theo bảng trạng thái của Hub. */
export interface SupplierOrderSummary {
  transCode: string | null;
  supplierTransId: string | null;
  status: string | null;
  outcome: OutcomeType;
  errorCode: string | null;
  createdAt: string | null;
}

export type OrderListResult =
  | { ok: true; orders: SupplierOrderSummary[]; trace: SupplierTrace }
  | {
      ok: false;
      message: string;
      unsupported?: boolean;
      trace: SupplierTrace;
    };

/** API không bắt buộc mà NCC này có (theo cấu hình). */
export interface AdapterFeatures {
  packages: boolean;
  check: boolean;
  checkBeforeSubmit: boolean;
  orderList: boolean;
  balance?: boolean;
  balanceBeforeSubmit?: boolean;
}

/** Số dư tài khoản đại lý tại NCC. sufficient = null: chưa rõ (Hub vẫn gửi đơn). */
export interface BalanceResult {
  ok: boolean;
  available: number | null;
  pending: number | null;
  currency: string | null;
  minimum: number | null;
  sufficient: boolean | null;
  message: string;
  trace: SupplierTrace;
}

export interface OrderRef {
  transCode: string;
  supplierTransId: string | null;
}

export interface RawCallback {
  body: unknown;
  /** Body gốc dạng chuỗi, dùng để kiểm chữ ký. */
  rawBody?: string;
  headers: Record<string, string | string[] | undefined>;
  ip: string;
}

export interface ParsedCallback {
  eventId: string;
  transCode?: string;
  supplierTransId?: string;
  result: SupplierResult;
}

export interface AdapterCapabilities {
  actions: OrderActionType[];
  callback: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

export type ConfigClass = new () => object;

/** Một trường cấu hình để giao diện dựng form nhập liệu. */
export interface AdapterConfigField {
  key: string;
  label: string;
  required: boolean;
  /** text (mặc định) hoặc boolean (bật/tắt, lưu "true"/"false"). */
  type?: 'text' | 'boolean';
  help?: string;
  placeholder?: string;
}

/**
 * Giao diện dùng trình soạn nào: FIELDS = form theo danh sách params/secrets cố định,
 * HTTP_CONFIG = trình soạn tích hợp (đường dẫn, biến, cách đọc phản hồi...).
 */
export type AdapterEditor = 'FIELDS' | 'HTTP_CONFIG';

/** Mô tả adapter cho người dùng: tên hiển thị và các trường params/secrets cần nhập. */
export interface AdapterMeta {
  label: string;
  description: string;
  editor: AdapterEditor;
  params: AdapterConfigField[];
  secrets: AdapterConfigField[];
}

export interface AdapterDescriptor extends AdapterMeta {
  type: string;
  actions: OrderActionType[];
  callback: boolean;
  /** params khởi tạo khi tạo NCC mới (vd bản tích hợp trống của HTTP_CONFIG). */
  defaultParams?: Record<string, unknown>;
}

/**
 * Contract chung cho mọi NCC.
 * Adapter stateless: chỉ đọc `ctx`, không throw với kết quả nghiệp vụ.
 */
export interface ProviderAdapter {
  readonly type: string;
  readonly meta: AdapterMeta;
  readonly capabilities: AdapterCapabilities;
  readonly paramsClass: ConfigClass;
  readonly secretsClass: ConfigClass;

  submit(ctx: SupplierContext, cmd: OrderCommand): Promise<SupplierResult>;
  query(ctx: SupplierContext, ref: OrderRef): Promise<SupplierResult>;
  testConnection(ctx: SupplierContext): Promise<ConnectionTestResult>;

  /** Tự kiểm tra cấu hình thay cho paramsClass/secretsClass (khi params có cấu trúc tự do). */
  validateConfig?(
    params: Record<string, unknown>,
    secrets: Record<string, unknown> | null,
  ): string[];
  /** Thao tác hỗ trợ theo cấu hình của từng NCC; không có thì dùng capabilities.actions. */
  supportedActions?(ctx: SupplierContext): OrderActionType[];
  /** Store bắt buộc gửi SĐT / serial cho thao tác nào; không có thì dùng mặc định của Hub. */
  fieldRules?(ctx: SupplierContext): OrderFieldRules;
  /** Số dư đại lý tại NCC; đơn (nếu có) dùng cho mức tối thiểu theo đơn. */
  checkBalance?(
    ctx: SupplierContext,
    order?: PackageCheckCommand | null,
  ): Promise<BalanceResult>;
  /** Trường thêm NCC cần (Store gửi trong `extra`); không có thì Store không được gửi `extra`. */
  extraFields?(ctx: SupplierContext): OrderExtraField[];
  defaultParams?(): Record<string, unknown>;

  /** API không bắt buộc NCC có; không khai báo nghĩa là không có API nào trong số đó. */
  features?(ctx: SupplierContext): AdapterFeatures;
  listPackages?(
    ctx: SupplierContext,
    filter: PackageFilter,
  ): Promise<PackageListResult>;
  checkPackage?(
    ctx: SupplierContext,
    cmd: PackageCheckCommand,
  ): Promise<PackageCheckResult>;
  listOrders?(
    ctx: SupplierContext,
    range: OrderRange,
  ): Promise<OrderListResult>;

  verifyCallback?(ctx: SupplierContext, raw: RawCallback): Promise<boolean>;
  parseCallback?(
    ctx: SupplierContext,
    raw: RawCallback,
  ): Promise<ParsedCallback>;
}

export const PROVIDER_ADAPTERS = Symbol('PROVIDER_ADAPTERS');
