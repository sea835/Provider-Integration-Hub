import { Module } from '@nestjs/common';
import { AnisimAdapter } from './infrastructure/adapters/anisim.adapter';
import { ProviderAdapterRegistry } from './application/provider-adapter.registry';

@Module({
  providers: [AnisimAdapter, ProviderAdapterRegistry],
  exports: [AnisimAdapter, ProviderAdapterRegistry],
})
export class ProviderAdapterModule {}
