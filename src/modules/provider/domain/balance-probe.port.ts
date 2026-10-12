import { ProviderConfig } from '@modules/provider/domain/provider-config';

export interface ProbeInput {
  /** Phân biệt kho token: id đối tác, hoặc khoá tạm khi thử cấu hình chưa lưu. */
  cacheKey: string;
  config: ProviderConfig;
  secrets: Record<string, string>;
  unitMultiplier: number;
  /** true: luôn đăng nhập lại để thấy bước đăng nhập (dùng cho Thử kết nối). */
  freshLogin?: boolean;
}

/** Một lời gọi HTTP đã che bí mật, để hiển thị ở công cụ Thử kết nối. */
export interface ProbeStep {
  kind: 'login' | 'balance';
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

interface ProbeBase {
  steps: ProbeStep[];
  /** Token lấy được, đã che bớt. */
  tokenPreview: string | null;
}

export type ProbeResult =
  | (ProbeBase & {
      ok: true;
      balance: number;
      rawValue: string;
      httpStatus: number;
      latencyMs: number;
    })
  | (ProbeBase & {
      ok: false;
      errorCode: string;
      errorMessage: string;
      httpStatus: number | null;
      latencyMs: number | null;
      /** Lỗi mạng tạm thời (timeout, 502/503/504): nên thử lại. */
      transient: boolean;
    });

/** Gọi API đối tác (đăng nhập nếu cần) rồi đọc số dư. Không bao giờ ném lỗi. */
export abstract class BalanceProbePort {
  abstract probe(input: ProbeInput): Promise<ProbeResult>;
  /** Chỉ chạy bước đăng nhập lấy token (để xem phản hồi và chọn đường dẫn token). */
  abstract probeLogin(input: ProbeInput): Promise<LoginProbeResult>;
}

export type BalanceProbeStepView = ProbeStep;

type ProbeFailure = Extract<ProbeResult, { ok: false }>;

/** Kết quả khi chỉ gọi thử API đăng nhập. */
export type LoginProbeResult =
  | (ProbeBase & {
      ok: true;
      httpStatus: number | null;
      latencyMs: number | null;
    })
  | ProbeFailure;
