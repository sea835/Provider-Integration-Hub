import { Module } from '@nestjs/common';
import { HealthController } from '@modules/health/presentation/health.controller';
import { HealthService } from '@modules/health/application/health.service';
import { DatabaseHealthPort } from '@modules/health/domain/database-health.port';
import { DrizzleDatabaseHealthAdapter } from '@modules/health/infrastructure/drizzle-database-health.adapter';

@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: DatabaseHealthPort,
      useClass: DrizzleDatabaseHealthAdapter,
    },
  ],
})
export class HealthModule {}
