import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { OrderQueuePort } from '@modules/transaction/domain/order-queue.port';
import { SupplierEventsPort } from '@modules/supplier/domain/supplier-events.port';
import {
  createRedisConnection,
  REDIS_CONNECTION,
} from '@infrastructure/queue/redis.provider';
import { BullmqOrderQueue } from '@infrastructure/queue/bullmq-order-queue';
import { RedisSupplierEvents } from '@infrastructure/queue/redis-supplier-events';
import { RedisTokenStore } from '@infrastructure/queue/redis-token-store';
import { TokenStorePort } from '@modules/provider-adapter/domain/token-store.port';

@Global()
@Module({
  providers: [
    { provide: REDIS_CONNECTION, useFactory: createRedisConnection },
    BullmqOrderQueue,
    { provide: OrderQueuePort, useExisting: BullmqOrderQueue },
    RedisSupplierEvents,
    { provide: SupplierEventsPort, useExisting: RedisSupplierEvents },
    RedisTokenStore,
    { provide: TokenStorePort, useExisting: RedisTokenStore },
  ],
  exports: [
    REDIS_CONNECTION,
    OrderQueuePort,
    SupplierEventsPort,
    TokenStorePort,
  ],
})
export class QueueModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CONNECTION) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
