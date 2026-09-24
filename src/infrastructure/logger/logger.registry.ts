import { LoggerPort } from '@common/logger';

/**
 * Registry global lưu logger instance theo bộ tag.
 * Mỗi bộ tag ([APP][User][UserService]) chỉ có đúng 1 instance cho toàn app,
 * LoggerPort.child() luôn đi qua đây thay vì tự tạo instance mới.
 *
 * Tag phải là định danh tĩnh (layer, context, tên class) — không đưa giá trị động
 * như userId, requestId vào tag, nếu không registry sẽ phình theo số request.
 * Dữ liệu động đặt ở meta; requestId đã được lấy tự động từ RequestContext.
 */
class LoggerRegistry {
    private readonly instances = new Map<string, LoggerPort>();

    getOrCreate(tags: readonly string[], factory: () => LoggerPort): LoggerPort {
        const key = JSON.stringify(tags);
        let instance = this.instances.get(key);
        if (!instance) {
            instance = factory();
            this.instances.set(key, instance);
        }
        return instance;
    }

    get size(): number {
        return this.instances.size;
    }

    /** Chỉ dùng trong test */
    clear(): void {
        this.instances.clear();
    }
}

export const loggerRegistry = new LoggerRegistry();
