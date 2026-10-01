/** BullMQ cấm dấu `:` trong jobId và dùng `:` làm phân cách key, nên tên dùng `-`. */
export const supplierQueueName = (supplierCode: string): string =>
  `supplier-${supplierCode}`;

export const SYSTEM_QUEUE = 'core-system';

export const JobName = {
  SUBMIT: 'SUBMIT',
  CHECK: 'CHECK',
  SWEEP: 'SWEEP',
} as const;

export const SWEEPER_SCHEDULER_ID = 'sweeper';

export interface OrderJobData {
  transCode: string;
}
