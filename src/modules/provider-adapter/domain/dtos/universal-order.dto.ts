export type UniversalAction =
  'BUY_DATA' | 'TOPUP' | 'ACTIVATE_SIM' | 'CANCEL_PACKAGE';

export interface UniversalOrderDto {
  /** Mã giao dịch duy nhất từ Store / Idempotency Key */
  requestId: string;

  /** Loại hành động giao dịch */
  action: UniversalAction;

  /** Số điện thoại thụ hưởng (chuẩn hóa 10 số, giữ số 0 đầu) */
  phone?: string;

  /** Mã SKU gói cước nội bộ chuẩn hóa (ví dụ: SM110, MD7, TOPUP_50K) */
  packageCode: string;

  /** Serial phôi SIM / ICCID (khi kích hoạt SIM/eSIM vật lý) */
  serial?: string;

  /** Chứa thông tin đặc thù bổ sung nếu cần */
  metadata?: Record<string, any>;
}
