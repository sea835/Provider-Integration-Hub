import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { BaseRepository } from '@common/base/base.repository';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { MerchantEntity } from '@modules/merchant/domain/merchant.entity';
import { MerchantRepositoryPort } from '@modules/merchant/domain/merchant.repository.port';
import { merchants } from '@modules/merchant/infrastructure/merchant.schema';

@Injectable()
export class MerchantRepository
  extends BaseRepository<MerchantEntity>
  implements MerchantRepositoryPort
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, merchants);
  }

  async findByApiKeyHash(hash: string): Promise<MerchantEntity | null> {
    const rows = await this.conn
      .select()
      .from(merchants)
      .where(eq(merchants.apiKeyHash, hash));
    return (rows[0] as MerchantEntity | undefined) ?? null;
  }
}
