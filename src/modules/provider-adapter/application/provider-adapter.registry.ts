import { Injectable, NotFoundException } from '@nestjs/common';
import { ProviderAdapterPort } from '../domain/provider-adapter.port';
import { AnisimAdapter } from '../infrastructure/adapters/anisim.adapter';

@Injectable()
export class ProviderAdapterRegistry {
  private readonly adapters = new Map<string, ProviderAdapterPort>();

  constructor(private readonly anisimAdapter: AnisimAdapter) {
    this.register(anisimAdapter);
  }

  register(adapter: ProviderAdapterPort): void {
    this.adapters.set(adapter.providerCode.toUpperCase(), adapter);
  }

  get(providerCode: string): ProviderAdapterPort {
    const code = providerCode.toUpperCase();
    const adapter = this.adapters.get(code);
    if (!adapter) {
      throw new NotFoundException(
        `Provider adapter for [${providerCode}] is not configured or supported`,
      );
    }
    return adapter;
  }

  has(providerCode: string): boolean {
    return this.adapters.has(providerCode.toUpperCase());
  }
}
