import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, desc, eq, inArray, lte, SQL } from 'drizzle-orm';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { DbContext } from '@infrastructure/database/db-context';
import { TransactionEntity } from '@modules/transaction/domain/transaction.entity';
import {
  StoreCallbackAttempt,
  StoreCallbackEntity,
  StoreCallbackEventType,
  StoreCallbackFilter,
  StoreCallbackRepositoryPort,
  StoreCallbackStatus,
} from '@modules/transaction/domain/store-callback';
import { storeCallbacks } from '@modules/transaction/infrastructure/store-callback.schema';

@Injectable()
export class StoreCallbackRepository implements StoreCallbackRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  private get conn(): NodePgDatabase {
    return DbContext.current() ?? this.db;
  }

  async enqueue(
    order: TransactionEntity,
    event: StoreCallbackEventType,
  ): Promise<void> {
    await this.conn.insert(storeCallbacks).values({
      transactionId: order.id,
      merchantId: order.merchantId,
      transCode: order.transCode,
      event,
      status: StoreCallbackStatus.PENDING,
      nextAttemptAt: new Date(),
    });
  }

  async claimDue(
    limit: number,
    leaseMs: number,
  ): Promise<StoreCallbackEntity[]> {
    const now = new Date();
    const due = this.conn
      .select({ id: storeCallbacks.id })
      .from(storeCallbacks)
      .where(
        and(
          eq(storeCallbacks.status, StoreCallbackStatus.PENDING),
          lte(storeCallbacks.nextAttemptAt, now),
        ),
      )
      .orderBy(asc(storeCallbacks.nextAttemptAt))
      .limit(limit)
      .for('update', { skipLocked: true });
    const rows = await this.conn
      .update(storeCallbacks)
      .set({
        nextAttemptAt: new Date(now.getTime() + leaseMs),
        updatedAt: now,
      })
      .where(inArray(storeCallbacks.id, due))
      .returning();
    return rows as StoreCallbackEntity[];
  }

  async recordAttempt(
    id: string,
    attempt: StoreCallbackAttempt,
  ): Promise<void> {
    const now = new Date();
    await this.conn
      .update(storeCallbacks)
      .set({
        attempts: attempt.attempts,
        status: attempt.status,
        nextAttemptAt: attempt.nextAttemptAt,
        lastUrl: attempt.url,
        lastHttpStatus: attempt.httpStatus,
        lastDurationMs: attempt.durationMs,
        lastError: attempt.error,
        lastResponse: attempt.response,
        deliveredAt:
          attempt.status === StoreCallbackStatus.DELIVERED ? now : null,
        updatedAt: now,
      })
      .where(eq(storeCallbacks.id, id));
  }

  async findById(id: string): Promise<StoreCallbackEntity | null> {
    const rows = await this.conn
      .select()
      .from(storeCallbacks)
      .where(eq(storeCallbacks.id, id));
    return (rows[0] as StoreCallbackEntity | undefined) ?? null;
  }

  async list(filter: StoreCallbackFilter): Promise<StoreCallbackEntity[]> {
    const conditions: SQL[] = [];
    if (filter.merchantId) {
      conditions.push(eq(storeCallbacks.merchantId, filter.merchantId));
    }
    if (filter.transactionId) {
      conditions.push(eq(storeCallbacks.transactionId, filter.transactionId));
    }
    if (filter.status)
      conditions.push(eq(storeCallbacks.status, filter.status));
    const rows = await this.conn
      .select()
      .from(storeCallbacks)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(storeCallbacks.createdAt))
      .limit(filter.limit);
    return rows as StoreCallbackEntity[];
  }

  async requeue(id: string): Promise<StoreCallbackEntity | null> {
    const rows = await this.conn
      .update(storeCallbacks)
      .set({
        status: StoreCallbackStatus.PENDING,
        nextAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storeCallbacks.id, id))
      .returning();
    return (rows[0] as StoreCallbackEntity | undefined) ?? null;
  }
}
