import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  createRedisConnection,
  REDIS_CONNECTION,
} from '@infrastructure/queue/redis.provider';

@Global()
@Module({
  providers: [{ provide: REDIS_CONNECTION, useFactory: createRedisConnection }],
  exports: [REDIS_CONNECTION],
})
export class QueueModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CONNECTION) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
