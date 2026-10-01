/**
 * Đẩy việc cho worker. Idempotent theo (transCode, loại job, lần thứ).
 * Implement bằng BullMQ ở infrastructure/queue.
 */
export abstract class OrderQueuePort {
  abstract enqueueSubmit(
    supplierCode: string,
    transCode: string,
    attempt: number,
  ): Promise<void>;
  abstract enqueueCheck(
    supplierCode: string,
    transCode: string,
    attempt: number,
    delayMs: number,
  ): Promise<void>;
}
