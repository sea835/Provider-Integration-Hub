import { Module } from '@nestjs/common';
import { PROVIDER_ADAPTERS } from '@modules/provider-adapter/domain/provider-adapter.port';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import { HttpJsonClient } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { AnisimAdapter } from '@modules/provider-adapter/infrastructure/adapters/anisim/anisim.adapter';
import { AdapterSpecPort } from '@modules/supplier/domain/adapter-spec.port';

/** Thêm NCC mới: viết 1 adapter rồi thêm vào danh sách PROVIDER_ADAPTERS. */
@Module({
  providers: [
    HttpJsonClient,
    AnisimAdapter,
    {
      provide: PROVIDER_ADAPTERS,
      useFactory: (anisim: AnisimAdapter) => [anisim],
      inject: [AnisimAdapter],
    },
    AdapterRegistry,
    { provide: AdapterSpecPort, useExisting: AdapterRegistry },
  ],
  exports: [AdapterRegistry, AdapterSpecPort],
})
export class ProviderAdapterModule {}
