import { IsOptional, IsString } from 'class-validator';
import {
  ConnectionTestResult,
  OrderCommand,
  OrderRef,
  ParsedCallback,
  ProviderAdapter,
  RawCallback,
} from '@modules/provider-adapter/domain/provider-adapter.port';
import {
  OutcomeType,
  SupplierResult,
} from '@modules/provider-adapter/domain/supplier-result';

class EmptyConfig {}

class FakeSecrets {
  @IsOptional()
  @IsString()
  token?: string;
}

/**
 * NCC giả cho e2e: mỗi SĐT có một kịch bản outcome. Mỗi lần submit/query lấy
 * phần tử kế tiếp; phần tử cuối được giữ nguyên cho các lần sau.
 */
export class FakeAdapter implements ProviderAdapter {
  readonly type = 'FAKE';
  readonly capabilities = {
    actions: ['BUY_DATA' as const],
    callback: true,
  };
  readonly paramsClass = EmptyConfig;
  readonly secretsClass = FakeSecrets;

  readonly calls: string[] = [];
  private readonly plans = new Map<string, OutcomeType[]>();
  private readonly phoneByTrans = new Map<string, string>();

  plan(phone: string, outcomes: OutcomeType[]): void {
    this.plans.set(phone, [...outcomes]);
  }

  submit(_ctx: unknown, cmd: OrderCommand): Promise<SupplierResult> {
    this.phoneByTrans.set(cmd.transCode, cmd.phone ?? '');
    this.calls.push(`submit:${cmd.transCode}`);
    return Promise.resolve(this.result(cmd.phone ?? '', cmd.transCode));
  }

  query(_ctx: unknown, ref: OrderRef): Promise<SupplierResult> {
    this.calls.push(`query:${ref.transCode}`);
    const phone = this.phoneByTrans.get(ref.transCode) ?? '';
    return Promise.resolve(this.result(phone, ref.transCode));
  }

  parseCallback(_ctx: unknown, raw: RawCallback): Promise<ParsedCallback> {
    const body = raw.body as {
      eventId: string;
      transCode: string;
      outcome: OutcomeType;
    };
    return Promise.resolve({
      eventId: body.eventId,
      transCode: body.transCode,
      result: { outcome: body.outcome, trace: { durationMs: 0 } },
    });
  }

  testConnection(): Promise<ConnectionTestResult> {
    return Promise.resolve({ ok: true, latencyMs: 1, message: 'ok' });
  }

  private result(phone: string, transCode: string): SupplierResult {
    const plan = this.plans.get(phone) ?? ['SUCCESS'];
    const outcome = plan.length > 1 ? plan.shift()! : plan[0];
    return {
      outcome,
      supplierTransId: `FAKE-${transCode}`,
      error:
        outcome === 'FAILED'
          ? { code: 'FAKE_FAILED', message: 'NCC giả báo lỗi' }
          : undefined,
      trace: { request: { phone }, durationMs: 1 },
    };
  }
}
