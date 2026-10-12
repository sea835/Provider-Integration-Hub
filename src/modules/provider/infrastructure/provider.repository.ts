import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from '@common/base/base.repository';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { normalizeProviderConfig } from '@modules/provider/domain/provider-config.validation';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import { ProviderRepositoryPort } from '@modules/provider/domain/provider.repository.port';
import { ProviderStatus } from '@modules/provider/domain/provider-status';
import { providers } from '@modules/provider/infrastructure/provider.schema';

@Injectable()
export class ProviderRepository
  extends BaseRepository<ProviderEntity>
  implements ProviderRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, providers);
  }

  /** Cấu hình lưu từ phiên bản trước có thể thiếu trường mới: luôn chuẩn hoá khi đọc. */
  private hydrate(row: ProviderEntity): ProviderEntity {
    return { ...row, config: normalizeProviderConfig(row.config) };
  }

  override async create(
    data: Partial<ProviderEntity>,
  ): Promise<ProviderEntity> {
    return this.hydrate(await super.create(data));
  }

  override async findById(id: string): Promise<ProviderEntity | null> {
    const row = await super.findById(id);
    return row ? this.hydrate(row) : null;
  }

  override async update(
    id: string,
    data: Partial<ProviderEntity>,
  ): Promise<ProviderEntity | null> {
    const row = await super.update(id, data);
    return row ? this.hydrate(row) : null;
  }

  async findByCode(code: string): Promise<ProviderEntity | null> {
    const result = (await this.conn
      .select()
      .from(providers)
      .where(eq(providers.code, code))) as ProviderEntity[];
    return result[0] ? this.hydrate(result[0]) : null;
  }

  async listAll(): Promise<ProviderEntity[]> {
    const rows = (await this.conn
      .select()
      .from(providers)
      .orderBy(asc(providers.name))) as ProviderEntity[];
    return rows.map((row) => this.hydrate(row));
  }

  async listActive(): Promise<ProviderEntity[]> {
    const rows = (await this.conn
      .select()
      .from(providers)
      .where(eq(providers.status, ProviderStatus.ACTIVE))) as ProviderEntity[];
    return rows.map((row) => this.hydrate(row));
  }
}
