import { LoggerPort, LogLevel, LogMeta } from '@common/logger';
import { LOG_LEVEL_PRIORITY, LoggerConfig } from './logger.config';
import { RequestContext } from './request-context';
import { loggerRegistry } from './logger.registry';

const LEVEL_COLOR: Record<LogLevel, string> = {
    error: '\x1b[31m',
    warn: '\x1b[33m',
    info: '\x1b[32m',
    debug: '\x1b[36m',
    verbose: '\x1b[90m',
};
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

export interface LogRecord {
    time: string;
    level: LogLevel;
    tags: string[];
    requestId?: string;
    msg: string;
    meta?: LogMeta;
    err?: { name: string; message: string; stack?: string };
}

export type LogWriter = (level: LogLevel, line: string) => void;

const defaultWriter: LogWriter = (level, line) => {
    const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    stream.write(line + '\n');
};

/**
 * Adapter implement LoggerPort, in log dạng tag:
 *   pretty: 2026-09-24 10:00:00.123 INFO  [req:0192f3a1] [APP][User][UserService] Created user {"userId":"..."}
 *   json:   {"time":"...","level":"info","tags":["APP","User","UserService"],"requestId":"...","msg":"Created user",...}
 */
export class TaggedLoggerAdapter extends LoggerPort {
    constructor(
        private readonly config: LoggerConfig,
        private readonly tags: string[] = [],
        private readonly writer: LogWriter = defaultWriter,
    ) {
        super();
    }

    /** Không tạo mới: cùng bộ tag luôn trả về cùng 1 instance từ loggerRegistry */
    child(...tags: string[]): LoggerPort {
        const fullTags = [...this.tags, ...tags.filter(Boolean)];
        return loggerRegistry.getOrCreate(fullTags, () => new TaggedLoggerAdapter(this.config, fullTags, this.writer));
    }

    error(message: string, error?: unknown, meta?: LogMeta): void {
        this.write('error', message, meta, error);
    }

    warn(message: string, meta?: LogMeta): void {
        this.write('warn', message, meta);
    }

    info(message: string, meta?: LogMeta): void {
        this.write('info', message, meta);
    }

    debug(message: string, meta?: LogMeta): void {
        this.write('debug', message, meta);
    }

    verbose(message: string, meta?: LogMeta): void {
        this.write('verbose', message, meta);
    }

    isLevelEnabled(level: LogLevel): boolean {
        return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.config.level];
    }

    private write(level: LogLevel, msg: string, meta?: LogMeta, error?: unknown): void {
        if (!this.isLevelEnabled(level)) return;

        const record: LogRecord = {
            time: new Date().toISOString(),
            level,
            tags: this.tags,
            requestId: RequestContext.requestId,
            msg,
            meta: meta && Object.keys(meta).length ? (this.redact(meta) as LogMeta) : undefined,
            err: error !== undefined ? this.serializeError(error) : undefined,
        };

        this.writer(level, this.config.format === 'json' ? JSON.stringify(record) : this.formatPretty(record));
    }

    private formatPretty(r: LogRecord): string {
        const useColor = process.stdout.isTTY;
        const paint = (color: string, s: string) => (useColor ? color + s + RESET : s);

        const time = r.time.replace('T', ' ').replace('Z', '');
        const level = paint(LEVEL_COLOR[r.level], r.level.toUpperCase().padEnd(7));
        const req = r.requestId ? paint(DIM, `[req:${r.requestId}]`) + ' ' : '';
        const tags = r.tags.map((t) => `[${t}]`).join('');
        const meta = r.meta ? ' ' + paint(DIM, JSON.stringify(r.meta)) : '';
        const stack = r.err ? '\n' + (r.err.stack ?? `${r.err.name}: ${r.err.message}`) : '';

        return `${paint(DIM, time)} ${level} ${req}${tags} ${r.msg}${meta}${stack}`;
    }

    private serializeError(error: unknown): LogRecord['err'] {
        if (error instanceof Error) {
            return { name: error.name, message: error.message, stack: error.stack };
        }
        return { name: 'NonError', message: typeof error === 'string' ? error : JSON.stringify(error) };
    }

    private redact(value: unknown, depth = 0): unknown {
        if (depth > 5 || value === null || typeof value !== 'object') return value;
        if (value instanceof Date) return value;
        if (Array.isArray(value)) return value.map((v) => this.redact(v, depth + 1));

        const keys = this.config.redactKeys.map((k) => k.toLowerCase());
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [
                k,
                keys.includes(k.toLowerCase()) ? '[REDACTED]' : this.redact(v, depth + 1),
            ]),
        );
    }
}
