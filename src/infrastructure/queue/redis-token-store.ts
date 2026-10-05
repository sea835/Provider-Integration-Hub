import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CONNECTION } from '@infrastructure/queue/redis.provider';
import { TokenStorePort } from '@modules/provider-adapter/domain/token-store.port';

@Injectable()
export class RedisTokenStore extends TokenStorePort {
  constructor(@Inject(REDIS_CONNECTION) private readonly redis: Redis) {
    super();
  }

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSec: number): Promise<void> {
    await this.redis.set(key, value, 'EX', Math.max(1, Math.floor(ttlSec)));
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async lock(key: string, ttlMs: number): Promise<boolean> {
    return (await this.redis.set(key, '1', 'PX', ttlMs, 'NX')) === 'OK';
  }

  async unlock(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
