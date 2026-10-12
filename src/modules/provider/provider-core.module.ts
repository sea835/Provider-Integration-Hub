import { Module } from '@nestjs/common';
import { DrizzleModule } from '@infrastructure/database/drizzle.module';
import { AlertChannelService } from '@modules/provider/application/alert-channel.service';
import { BalanceCheckService } from '@modules/provider/application/balance-check.service';
import { ProviderSecrets } from '@modules/provider/application/provider-secrets';
import { ProviderService } from '@modules/provider/application/provider.service';
import { AlertChannelRepositoryPort } from '@modules/provider/domain/alert-channel.repository.port';
import { AlertNotifierPort } from '@modules/provider/domain/alert-notifier.port';
import { BalanceCheckRepositoryPort } from '@modules/provider/domain/balance-check.repository.port';
import { BalanceProbePort } from '@modules/provider/domain/balance-probe.port';
import { CheckSchedulerPort } from '@modules/provider/domain/check-scheduler.port';
import { ProviderRepositoryPort } from '@modules/provider/domain/provider.repository.port';
import { TokenStorePort } from '@modules/provider/domain/token-store.port';
import { AlertChannelRepository } from '@modules/provider/infrastructure/alert-channel.repository';
import { BullmqCheckScheduler } from '@modules/provider/infrastructure/balance-check.queue';
import { BalanceCheckRepository } from '@modules/provider/infrastructure/balance-check.repository';
import { HttpJsonClient } from '@modules/provider/infrastructure/http/http-json.client';
import { HttpConfigBalanceProbe } from '@modules/provider/infrastructure/http-config/http-config.balance-probe';
import { TokenManager } from '@modules/provider/infrastructure/http-config/http-config.token-manager';
import { ProviderRepository } from '@modules/provider/infrastructure/provider.repository';
import { RedisTokenStore } from '@modules/provider/infrastructure/redis-token-store';
import { TelegramNotifier } from '@modules/provider/infrastructure/telegram-notifier';

/** Phần dùng chung cho tiến trình API và worker: kho dữ liệu, engine gọi API, cảnh báo, lịch quét. */
@Module({
  imports: [DrizzleModule],
  providers: [
    ProviderService,
    BalanceCheckService,
    AlertChannelService,
    ProviderSecrets,
    HttpJsonClient,
    TokenManager,
    BullmqCheckScheduler,
    { provide: ProviderRepositoryPort, useClass: ProviderRepository },
    { provide: BalanceCheckRepositoryPort, useClass: BalanceCheckRepository },
    { provide: TokenStorePort, useClass: RedisTokenStore },
    { provide: BalanceProbePort, useClass: HttpConfigBalanceProbe },
    { provide: AlertChannelRepositoryPort, useClass: AlertChannelRepository },
    { provide: AlertNotifierPort, useClass: TelegramNotifier },
    { provide: CheckSchedulerPort, useExisting: BullmqCheckScheduler },
  ],
  exports: [
    ProviderService,
    BalanceCheckService,
    AlertChannelService,
    ProviderRepositoryPort,
    BullmqCheckScheduler,
  ],
})
export class ProviderCoreModule {}
