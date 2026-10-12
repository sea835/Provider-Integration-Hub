/**
 * SENT: đã gửi. FAILED: kênh có cấu hình nhưng gửi lỗi (sẽ thử lại ở lượt quét sau).
 * DISABLED: chưa cấu hình hoặc đang tắt kênh, không có gì để gửi.
 */
export type DeliveryStatus = 'SENT' | 'FAILED' | 'DISABLED';

export interface DeliveryResult {
  status: DeliveryStatus;
  /** Lý do khi không gửi được, để hiển thị cho người cấu hình. */
  detail?: string;
}

/** Thông tin kết nối Telegram dùng thử trước khi lưu. */
export interface TelegramTarget {
  botToken: string;
  chatId: string;
}

/** Kênh gửi cảnh báo (v1: một nhóm Telegram dùng chung). Không bao giờ ném lỗi. */
export abstract class AlertNotifierPort {
  abstract send(text: string): Promise<DeliveryResult>;
  /** Gửi tới đúng bot / nhóm chỉ định, bỏ qua cấu hình đã lưu (nút Gửi tin thử). */
  abstract sendTo(
    target: TelegramTarget,
    text: string,
  ): Promise<DeliveryResult>;
}
