export const EventSource = {
  API: 'API',
  SUBMIT: 'SUBMIT',
  CHECK: 'CHECK',
  CALLBACK: 'CALLBACK',
  OPERATOR: 'OPERATOR',
  SWEEPER: 'SWEEPER',
} as const;

export type EventSourceType = (typeof EventSource)[keyof typeof EventSource];

export const EventType = {
  ACCEPTED: 'ACCEPTED',
  SUBMIT_STARTED: 'SUBMIT_STARTED',
  RESULT: 'RESULT',
  CONFLICT: 'CONFLICT',
  RESUBMIT_REQUESTED: 'RESUBMIT_REQUESTED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  RECHECK_REQUESTED: 'RECHECK_REQUESTED',
} as const;

export type EventTypeType = (typeof EventType)[keyof typeof EventType];

export class TransactionEventEntity {
  id: string;
  transactionId: string;
  source: EventSourceType;
  type: EventTypeType;
  outcome: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  configVersion: number | null;
  httpStatus: number | null;
  durationMs: number | null;
  message: string | null;
  request: unknown;
  response: unknown;
  createdAt: Date;
}

export type NewTransactionEvent = Omit<
  TransactionEventEntity,
  | 'id'
  | 'createdAt'
  | 'outcome'
  | 'fromStatus'
  | 'toStatus'
  | 'configVersion'
  | 'httpStatus'
  | 'durationMs'
  | 'message'
  | 'request'
  | 'response'
> &
  Partial<
    Pick<
      TransactionEventEntity,
      | 'outcome'
      | 'fromStatus'
      | 'toStatus'
      | 'configVersion'
      | 'httpStatus'
      | 'durationMs'
      | 'message'
      | 'request'
      | 'response'
    >
  >;

export class CallbackEventEntity {
  id: string;
  supplierId: string;
  eventId: string;
  payload: unknown;
  matchedTransactionId: string | null;
  receivedAt: Date;
}
