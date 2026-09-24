import { BaseEntity } from '@common/base/base.entity';

export class SessionEntity extends BaseEntity {
  userId: string;
  refreshTokenHash: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
  isRevoked: boolean;
}
