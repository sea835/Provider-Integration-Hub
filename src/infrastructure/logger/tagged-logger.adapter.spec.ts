/* eslint-disable no-control-regex */
import { LogLevel } from '@common/logger';
import { LoggerConfig } from './logger.config';
import { RequestContext } from './request-context';
import { TaggedLoggerAdapter, LogRecord } from './tagged-logger.adapter';
import { loggerRegistry } from './logger.registry';

describe('TaggedLoggerAdapter', () => {
  const baseConfig: LoggerConfig = {
    level: 'info',
    format: 'json',
    redactKeys: ['password'],
  };

  beforeEach(() => loggerRegistry.clear());

  function setup(config: Partial<LoggerConfig> = {}) {
    const lines: { level: LogLevel; line: string }[] = [];
    const logger = new TaggedLoggerAdapter(
      { ...baseConfig, ...config },
      [],
      (level, line) => lines.push({ level, line }),
    );
    return { logger, lines };
  }

  it('nối tag qua child()', () => {
    const { logger, lines } = setup();
    logger.child('APP').child('User', 'UserService').info('hello');

    expect(JSON.parse(lines[0].line) as LogRecord).toMatchObject({
      level: 'info',
      tags: ['APP', 'User', 'UserService'],
      msg: 'hello',
    });
  });

  it('cùng bộ tag dùng lại 1 instance từ registry', () => {
    const { logger } = setup();
    const a = logger.child('APP', 'User', 'UserService');
    const b = logger.child('APP').child('User').child('UserService');

    expect(a).toBe(b);
    expect(logger.child('APP', 'User')).toBe(logger.child('APP').child('User'));
    expect(loggerRegistry.size).toBe(3); // [APP], [APP,User], [APP,User,UserService]
  });

  it('format pretty dạng [TAG][TAG]', () => {
    const { logger, lines } = setup({ format: 'pretty' });
    logger.child('APP', 'User').info('hello', { id: 1 });

    const plainLine = lines[0].line.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plainLine).toMatch(/INFO\s+\[APP\]\[User\] hello \{"id":1\}$/);
  });

  it('lọc theo LOG_LEVEL', () => {
    const { logger, lines } = setup({ level: 'warn' });
    logger.info('skip');
    logger.debug('skip');
    logger.warn('keep');

    expect(lines.map((l) => l.level)).toEqual(['warn']);
  });

  it('redact key nhạy cảm, kể cả lồng nhau', () => {
    const { logger, lines } = setup();
    logger.info('login', { user: { email: 'a@b.c', Password: '123' } });

    expect((JSON.parse(lines[0].line) as LogRecord).meta).toEqual({
      user: { email: 'a@b.c', Password: '[REDACTED]' },
    });
  });

  it('serialize error và gắn requestId từ context', () => {
    const { logger, lines } = setup();
    RequestContext.run({ requestId: 'req-1' }, () =>
      logger.error('boom', new Error('fail')),
    );

    const record = JSON.parse(lines[0].line) as LogRecord;
    expect(record.requestId).toBe('req-1');
    expect(record.err).toMatchObject({ name: 'Error', message: 'fail' });
  });
});
