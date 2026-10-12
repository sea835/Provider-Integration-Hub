import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DbContext } from '@infrastructure/database/db-context';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { AlertChannelEntity } from '@modules/provider/domain/alert-channel.entity';
import { AlertChannelRepositoryPort } from '@modules/provider/domain/alert-channel.repository.port';
import { alertChannels } from '@modules/provider/infrastructure/alert-channel.schema';

@Injectable()
export class AlertChannelRepository implements AlertChannelRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  private get conn(): NodePgDatabase {
    return DbContext.current() ?? this.db;
  }

  async findByType(type: string): Promise<AlertChannelEntity | null> {
    const rows = (await this.conn
      .select()
      .from(alertChannels)
      .where(eq(alertChannels.type, type))) as AlertChannelEntity[];
    return rows[0] ?? null;
  }

  async save(
    type: string,
    data: Pick<
      AlertChannelEntity,
      'enabled' | 'config' | 'encryptedSecrets'
    > & {
      updatedBy?: string;
    },
  ): Promise<AlertChannelEntity> {
    const rows = (await this.conn
      .insert(alertChannels)
      .values({ type, ...data, createdBy: data.updatedBy })
      .onConflictDoUpdate({
        target: alertChannels.type,
        set: { ...data, updatedAt: new Date() },
      })
      .returning()) as AlertChannelEntity[];
    return rows[0];
  }
}
