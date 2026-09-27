import type { ApiErrorBody } from "./types";

const STATUS_FALLBACK: Record<number, string> = {
  0: "Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.",
  400: "Dữ liệu gửi lên không hợp lệ.",
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy dữ liệu yêu cầu.",
  409: "Dữ liệu bị trùng với bản ghi đã có.",
  429: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
  500: "Máy chủ gặp sự cố. Vui lòng thử lại sau.",
  502: "Không thể kết nối tới máy chủ API.",
  503: "Hệ thống tạm thời chưa sẵn sàng.",
};

const MESSAGE_RULES: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^property (\w+) should not exist$/i, (m) => `Máy chủ chưa hỗ trợ cập nhật trường “${m[1]}”.`],
  [/too many requests/i, () => STATUS_FALLBACK[429]],
  [/^Record with ID .+ not found$/i, () => STATUS_FALLBACK[404]],
  [/^Internal server error occurred$/i, () => STATUS_FALLBACK[500]],
];

export function humanizeMessage(raw: string): string {
  const text = raw.trim();
  for (const [pattern, format] of MESSAGE_RULES) {
    const match = text.match(pattern);
    if (match) return format(match);
  }
  return text;
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && "message" in value;
}

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];
  readonly details?: unknown;
  readonly requestId?: string;
  readonly retryAfter?: number;

  constructor(init: {
    status: number;
    messages: string[];
    details?: unknown;
    requestId?: string;
    retryAfter?: number;
  }) {
    const messages = init.messages.length > 0 ? init.messages : [STATUS_FALLBACK[init.status] ?? STATUS_FALLBACK[500]];
    super(messages[0]);
    this.name = "ApiError";
    this.status = init.status;
    this.messages = messages;
    this.details = init.details;
    this.requestId = init.requestId;
    this.retryAfter = init.retryAfter;
  }

  static network(): ApiError {
    return new ApiError({ status: 0, messages: [STATUS_FALLBACK[0]] });
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const retryHeader = Number(response.headers.get("retry-after"));
    const raw = isErrorBody(body) ? body.message : [];
    const list = (Array.isArray(raw) ? raw : [raw]).filter((m): m is string => typeof m === "string" && m.length > 0);
    return new ApiError({
      status: response.status,
      messages: list.map(humanizeMessage),
      details: isErrorBody(body) ? body.details : undefined,
      requestId: (isErrorBody(body) ? body.requestId : undefined) ?? response.headers.get("x-request-id") ?? undefined,
      retryAfter: Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined,
    });
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown, fallback = "Đã có lỗi xảy ra. Vui lòng thử lại."): string {
  if (isApiError(error)) return error.messages.join(" · ");
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
