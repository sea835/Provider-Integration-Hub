import { Module } from '@nestjs/common';
import { MerchantModule } from '@modules/merchant/merchant.module';
import { SupplierModule } from '@modules/supplier/supplier.module';
import { ProviderAdapterModule } from '@modules/provider-adapter/provider-adapter.module';
import {
  CallbackEventRepositoryPort,
  TransactionEventRepositoryPort,
  TransactionRepositoryPort,
} from '@modules/transaction/domain/transaction.repository.port';
import { TransactionRepository } from '@modules/transaction/infrastructure/transaction.repository';
import { StoreCallbackRepositoryPort } from '@modules/transaction/domain/store-callback';
import { StoreCallbackRepository } from '@modules/transaction/infrastructure/store-callback.repository';
import {
  CallbackEventRepository,
  TransactionEventRepository,
} from '@modules/transaction/infrastructure/transaction-event.repository';
import { OrderService } from '@modules/transaction/application/order.service';
import { OrderStateService } from '@modules/transaction/application/order-state.service';
import { OrderQueryService } from '@modules/transaction/application/order-query.service';
import { CallbackService } from '@modules/transaction/application/callback.service';
import { OrderReconcileService } from '@modules/transaction/application/order-reconcile.service';
import { OrderController } from '@modules/transaction/presentation/order.controller';
import { AdminOrderController } from '@modules/transaction/presentation/admin-order.controller';
import { CallbackController } from '@modules/transaction/presentation/callback.controller';

@Module({
  imports: [MerchantModule, SupplierModule, ProviderAdapterModule],
  controllers: [OrderController, AdminOrderController, CallbackController],
  providers: [
    OrderService,
    OrderStateService,
    OrderQueryService,
    OrderReconcileService,
    CallbackService,
    { provide: TransactionRepositoryPort, useClass: TransactionRepository },
    {
      provide: TransactionEventRepositoryPort,
      useClass: TransactionEventRepository,
    },
    { provide: CallbackEventRepositoryPort, useClass: CallbackEventRepository },
    {
      provide: StoreCallbackRepositoryPort,
      useClass: StoreCallbackRepository,
    },
  ],
  exports: [
    OrderStateService,
    OrderQueryService,
    TransactionRepositoryPort,
    StoreCallbackRepositoryPort,
  ],
})
export class TransactionModule {}
