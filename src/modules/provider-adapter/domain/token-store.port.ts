/**
 * Nơi lưu token đăng nhập NCC dùng chung giữa API và mọi worker.
 * Giá trị đã được mã hoá trước khi lưu.
 */
export abstract class TokenStorePort {
  abstract get(key: string): Promise<string | null>;
  abstract set(key: string, value: string, ttlSec: number): Promise<void>;
  abstract delete(key: string): Promise<void>;
  /** Khoá ngắn hạn để nhiều tiến trình không cùng đăng nhập một lúc. */
  abstract lock(key: string, ttlMs: number): Promise<boolean>;
  abstract unlock(key: string): Promise<void>;
}
