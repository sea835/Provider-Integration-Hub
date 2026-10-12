/** Lịch quét số dư định kỳ của từng đối tác. */
export abstract class CheckSchedulerPort {
  /** Tạo hoặc cập nhật lịch (gọi lại với chu kỳ mới là đổi lịch ngay). */
  abstract schedule(providerId: string, intervalMinutes: number): Promise<void>;
  abstract unschedule(providerId: string): Promise<void>;
}
