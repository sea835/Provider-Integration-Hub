import { Module } from '@nestjs/common';
import { AlertChannelController } from '@modules/provider/presentation/alert-channel.controller';
import { BalanceCheckController } from '@modules/provider/presentation/balance-check.controller';
import { ProviderController } from '@modules/provider/presentation/provider.controller';
import { ProviderCoreModule } from '@modules/provider/provider-core.module';

/** Tiến trình API: các endpoint quản lý đối tác và tra cứu lịch sử số dư. */
@Module({
  imports: [ProviderCoreModule],
  controllers: [
    ProviderController,
    BalanceCheckController,
    AlertChannelController,
  ],
})
export class ProviderModule {}
