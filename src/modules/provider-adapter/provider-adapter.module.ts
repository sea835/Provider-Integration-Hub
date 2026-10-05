import { Module } from '@nestjs/common';
import { PROVIDER_ADAPTERS } from '@modules/provider-adapter/domain/provider-adapter.port';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import { HttpJsonClient } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { HubStandardAdapter } from '@modules/provider-adapter/infrastructure/adapters/hub-standard/hub-standard.adapter';
import { HttpConfigAdapter } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.adapter';
import { TokenManager } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.token-manager';
import { IntegrationPreviewService } from '@modules/provider-adapter/application/integration-preview.service';
import { IntegrationCallService } from '@modules/provider-adapter/application/integration-call.service';
import { AdapterSpecPort } from '@modules/supplier/domain/adapter-spec.port';

/**
 * HUB_STANDARD: NCC theo Quy chuẩn API v1. HTTP_CONFIG: NCC có API riêng, cấu hình trên giao diện.
 * Chỉ viết adapter code khi NCC cần thứ giao diện không làm được (ký RSA, SOAP...).
 */
@Module({
  providers: [
    HttpJsonClient,
    HubStandardAdapter,
    TokenManager,
    HttpConfigAdapter,
    {
      provide: PROVIDER_ADAPTERS,
      useFactory: (standard: HubStandardAdapter, config: HttpConfigAdapter) => [
        standard,
        config,
      ],
      inject: [HubStandardAdapter, HttpConfigAdapter],
    },
    IntegrationPreviewService,
    IntegrationCallService,
    AdapterRegistry,
    { provide: AdapterSpecPort, useExisting: AdapterRegistry },
  ],
  exports: [
    AdapterRegistry,
    AdapterSpecPort,
    IntegrationPreviewService,
    IntegrationCallService,
  ],
})
export class ProviderAdapterModule {}
