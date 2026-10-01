import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { LoggerPort, LogLayer } from '@common/logger';
import {
  SupplierChangedEvent,
  SupplierEventsPort,
} from '@modules/supplier/domain/supplier-events.port';
import { REDIS_CONNECTION } from '@infrastructure/queue/redis.provider';

const CHANNEL = 'core:supplier.changed';

/** Pub/sub qua Redis. Kết nối subscribe phải tách riêng (không chạy lệnh khác được). */
@Injectable()
export class RedisSupplierEvents
  extends SupplierEventsPort
  implements OnApplicationShutdown
{
  private readonly logger: LoggerPort;
  private readonly handlers: Array<(event: SupplierChangedEvent) => void> = [];
  private subscriber?: Redis;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    logger: LoggerPort,
  ) {
    super();
    this.logger = logger.child(
      LogLayer.INFRASTRUCTURE,
      'Queue',
      RedisSupplierEvents.name,
    );
  }

  async publishChanged(event: SupplierChangedEvent): Promise<void> {
    await this.redis.publish(CHANNEL, JSON.stringify(event));
  }

  onChanged(handler: (event: SupplierChangedEvent) => void): void {
    this.handlers.push(handler);
    if (this.subscriber) return;

    this.subscriber = this.redis.duplicate();
    this.subscriber.on('message', (_channel, message) =>
      this.dispatch(message),
    );
    this.subscriber.subscribe(CHANNEL).catch((error: unknown) => {
      this.logger.error('Không subscribe được kênh cấu hình NCC', error);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }

  private dispatch(message: string): void {
    let event: SupplierChangedEvent;
    try {
      event = JSON.parse(message) as SupplierChangedEvent;
    } catch {
      return;
    }
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error('Handler sự kiện cấu hình NCC lỗi', error, {
          code: event.code,
        });
      }
    }
  }
}
