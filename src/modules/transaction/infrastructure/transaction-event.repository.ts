import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { DbContext } from '@infrastructure/database/db-context';
import {
  CallbackEventRepositoryPort,
  TransactionEventRepositoryPort,
} from '@modules/transaction/domain/transaction.repository.port';
import {
  CallbackEventEntity,
  NewTransactionEvent,
  TransactionEventEntity,
} from '@modules/transaction/domain/transaction-event';
import {
  callbackEvents,
  transactionEvents,
} from '@modules/transaction/infrastructure/transaction-event.schema';

@Injectable()
export class TransactionEventRepository implements TransactionEventRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  async record(event: NewTransactionEvent): Promise<void> {
    await (DbContext.current() ?? this.db)
      .insert(transactionEvents)
      .values(event);
  }

  async listByTransaction(
    transactionId: string,
  ): Promise<TransactionEventEntity[]> {
    const rows = await (DbContext.current() ?? this.db)
      .select()
      .from(transactionEvents)
      .where(eq(transactionEvents.transactionId, transactionId))
      .orderBy(asc(transactionEvents.createdAt));
    return rows as TransactionEventEntity[];
  }
}

@Injectable()
export class CallbackEventRepository implements CallbackEventRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  async insertIfAbsent(
    event: Omit<
      CallbackEventEntity,
      'id' | 'receivedAt' | 'matchedTransactionId'
    >,
  ): Promise<CallbackEventEntity | null> {
    const rows = await (DbContext.current() ?? this.db)
      .insert(callbackEvents)
      .values(event)
      .onConflictDoNothing({
        target: [callbackEvents.supplierId, callbackEvents.eventId],
      })
      .returning();
    return rows[0] ?? null;
  }

  async markMatched(id: string, transactionId: string): Promise<void> {
    await (DbContext.current() ?? this.db)
      .update(callbackEvents)
      .set({ matchedTransactionId: transactionId })
      .where(eq(callbackEvents.id, id));
  }
}
