import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from '@infrastructure/logger/logger.module';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';
import { UserModule } from '@modules/user/user.module';
import { AuthenticationModule } from '@modules/authentication/authentication.module';
import { AuthorizationModule } from '@modules/authorization/authorization.module';
import { HealthModule } from '@modules/health/health.module';
import { CatalogModule } from '@modules/catalog/catalog.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { ProviderAdapterModule } from '@modules/provider-adapter/provider-adapter.module';
import { SupplierModule } from '@modules/supplier/supplier.module';
import { JwtAuthGuard } from '@modules/authentication/presentation/guards/jwt-auth.guard';
import { PoliciesGuard } from '@modules/authorization/presentation/guards/policies.guard';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    LoggerModule,
    DrizzleModule,
    UserModule,
    AuthenticationModule,
    AuthorizationModule,
    HealthModule,
    CatalogModule,
    TransactionModule,
    ProviderAdapterModule,
    SupplierModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PoliciesGuard,
    },
  ],
})
export class AppModule {}
