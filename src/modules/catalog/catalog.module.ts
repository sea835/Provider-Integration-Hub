import { Module } from '@nestjs/common';
import { CatalogController } from './presentation/catalog.controller';
import { CatalogService } from './application/catalog.service';
import { ProviderAdapterModule } from '@modules/provider-adapter/provider-adapter.module';

@Module({
  imports: [ProviderAdapterModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
