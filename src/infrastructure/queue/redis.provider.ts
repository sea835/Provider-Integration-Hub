import { Redis } from 'ioredis';

export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');

/** BullMQ yêu cầu `maxRetriesPerRequest: null` cho kết nối dùng bởi worker. */
export function createRedisConnection(): Redis {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
}
