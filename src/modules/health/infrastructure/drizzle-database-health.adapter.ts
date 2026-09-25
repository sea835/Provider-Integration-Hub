import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@infrastructure/database/drizzle.provider';
import { DatabaseHealthPort } from '@modules/health/domain/database-health.port';

@Injectable()
export class DrizzleDatabaseHealthAdapter extends DatabaseHealthPort {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {
    super();
  }

  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }
}
