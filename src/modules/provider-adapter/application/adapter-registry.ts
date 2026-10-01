import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  ConnectionTestResult,
  PROVIDER_ADAPTERS,
  ProviderAdapter,
  SupplierContext,
} from '@modules/provider-adapter/domain/provider-adapter.port';
import { UnknownAdapterTypeError } from '@modules/provider-adapter/domain/adapter.errors';
import { AdapterSpecPort } from '@modules/supplier/domain/adapter-spec.port';

@Injectable()
export class AdapterRegistry extends AdapterSpecPort {
  private readonly adapters: Map<string, ProviderAdapter>;

  constructor(@Inject(PROVIDER_ADAPTERS) adapters: ProviderAdapter[]) {
    super();
    this.adapters = new Map(adapters.map((a) => [a.type, a]));
  }

  get(type: string): ProviderAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) throw new UnknownAdapterTypeError(type);
    return adapter;
  }

  types(): string[] {
    return [...this.adapters.keys()];
  }

  async validateConfig(
    adapterType: string,
    params: Record<string, unknown>,
    secrets: Record<string, unknown> | null,
  ): Promise<string[]> {
    const adapter = this.get(adapterType);
    const issues = await validateAgainst(adapter.paramsClass, params, 'params');
    if (secrets !== null) {
      issues.push(
        ...(await validateAgainst(adapter.secretsClass, secrets, 'secrets')),
      );
    }
    return issues;
  }

  testConnection(
    adapterType: string,
    ctx: SupplierContext,
  ): Promise<ConnectionTestResult> {
    return this.get(adapterType).testConnection(ctx);
  }
}

async function validateAgainst(
  cls: new () => object,
  value: Record<string, unknown>,
  prefix: string,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, value), {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: false,
  });
  return flatten(errors).map((msg) => `${prefix}.${msg}`);
}

function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map(
      (msg) => `${path}: ${msg}`,
    );
    return [...own, ...flatten(error.children ?? [], path)];
  });
}
