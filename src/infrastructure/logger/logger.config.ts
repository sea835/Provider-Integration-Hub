import { LogLevel } from '@common/logger';

export type LogFormat = 'pretty' | 'json';

export interface LoggerConfig {
    level: LogLevel;
    format: LogFormat;
    redactKeys: string[];
}

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    verbose: 4,
};

const DEFAULT_REDACT_KEYS = ['password', 'token', 'accessToken', 'refreshToken', 'secret', 'authorization', 'apiKey'];

export function loadLoggerConfig(env: NodeJS.ProcessEnv = process.env): LoggerConfig {
    const level = (env.LOG_LEVEL ?? 'info') as LogLevel;
    const isProd = env.NODE_ENV === 'production';

    return {
        level: level in LOG_LEVEL_PRIORITY ? level : 'info',
        format: (env.LOG_FORMAT as LogFormat) ?? (isProd ? 'json' : 'pretty'),
        redactKeys: DEFAULT_REDACT_KEYS,
    };
}
