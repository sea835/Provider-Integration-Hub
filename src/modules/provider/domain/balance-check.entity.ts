export class BalanceCheckEntity {
  id: string;
  providerId: string;
  status: string;
  balance: number | null;
  httpStatus: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  checkedAt: Date;
}
