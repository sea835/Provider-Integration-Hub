import { SessionEntity } from '@modules/authentication/domain/session.entity';

export abstract class SessionRepositoryPort {
  abstract create(data: Partial<SessionEntity>): Promise<SessionEntity>;
  abstract findById(id: string): Promise<SessionEntity | null>;
  abstract findValidSession(id: string): Promise<SessionEntity | null>;
  abstract revokeSession(id: string): Promise<boolean>;
  abstract revokeAllUserSessions(userId: string): Promise<boolean>;
}
