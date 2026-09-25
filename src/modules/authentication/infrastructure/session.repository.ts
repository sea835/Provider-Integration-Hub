import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gt } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { SessionEntity } from '@modules/auth/domain/session.entity';
import { SessionRepositoryPort } from '@modules/auth/domain/session.repository.port';
import { sessions } from '@modules/auth/infrastructure/session.schema';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';

@Injectable()
export class SessionRepository
  extends BaseRepository<SessionEntity>
  implements SessionRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, sessions);
  }

  async findValidSession(id: string): Promise<SessionEntity | null> {
    const result = (await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.id, id),
          eq(sessions.isRevoked, false),
          gt(sessions.expiresAt, new Date()),
        ),
      )) as SessionEntity[];

    return result[0] || null;
  }

  async revokeSession(id: string): Promise<boolean> {
    const result = await this.db
      .update(sessions)
      .set({ isRevoked: true })
      .where(eq(sessions.id, id))
      .returning();

    return result.length > 0;
  }

  async revokeAllUserSessions(userId: string): Promise<boolean> {
    const result = await this.db
      .update(sessions)
      .set({ isRevoked: true })
      .where(eq(sessions.userId, userId))
      .returning();

    return result.length > 0;
  }
}
