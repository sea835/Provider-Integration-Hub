import {
  SupplierResult,
  unknownResult,
} from '@modules/provider-adapter/domain/supplier-result';

/** Kết quả xử lý một job: xong, hoặc hoãn lại (NCC đang PAUSED). */
export type ProcessOutcome =
  { kind: 'DONE' } | { kind: 'DELAY'; delayMs: number };

export const DONE: ProcessOutcome = { kind: 'DONE' };
export const delay = (delayMs: number): ProcessOutcome => ({
  kind: 'DELAY',
  delayMs,
});

/** Hoãn job khi NCC không ACTIVE. */
export const SUPPLIER_PAUSED_DELAY_MS = 60_000;

/** Adapter không được throw với kết quả nghiệp vụ; nếu throw (bug) thì coi là UNKNOWN. */
export async function callAdapter(
  fn: () => Promise<SupplierResult>,
): Promise<{ result: SupplierResult; error?: unknown }> {
  const startedAt = Date.now();
  try {
    return { result: await fn() };
  } catch (error) {
    return {
      error,
      result: unknownResult(
        `Adapter lỗi: ${error instanceof Error ? error.message : String(error)}`,
        { durationMs: Date.now() - startedAt },
        'ADAPTER_ERROR',
      ),
    };
  }
}
