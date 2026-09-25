/**
 * Output Port kiểm tra database còn phản hồi (Hexagonal Architecture).
 * Adapter ném lỗi nếu không kết nối / truy vấn được.
 */
export abstract class DatabaseHealthPort {
  abstract ping(): Promise<void>;
}
