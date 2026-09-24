export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export type LogMeta = Record<string, unknown>;

/**
 * Output port cho logging (Hexagonal).
 * Application/Presentation chỉ phụ thuộc vào abstract class này,
 * implementation cụ thể nằm ở infrastructure/logger.
 *
 * Abstract class được dùng trực tiếp làm DI token của Nest.
 */
export abstract class LoggerPort {
    /** Tạo logger con, nối thêm tag: [APP][User][UserService] */
    abstract child(...tags: string[]): LoggerPort;

    abstract error(message: string, error?: unknown, meta?: LogMeta): void;
    abstract warn(message: string, meta?: LogMeta): void;
    abstract info(message: string, meta?: LogMeta): void;
    abstract debug(message: string, meta?: LogMeta): void;
    abstract verbose(message: string, meta?: LogMeta): void;
}
