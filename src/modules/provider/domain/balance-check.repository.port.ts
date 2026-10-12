import { PaginatedResult } from '@common/base/pagination.dto';
import { BalanceCheckEntity } from '@modules/provider/domain/balance-check.entity';

export interface BalanceCheckFilter {
  providerId?: string;
  status?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface BalancePoint {
  providerId: string;
  at: Date;
  balance: number;
}

export abstract class BalanceCheckRepositoryPort {
  abstract create(
    data: Omit<BalanceCheckEntity, 'id' | 'checkedAt'> & { checkedAt?: Date },
  ): Promise<BalanceCheckEntity>;
  abstract findPaginated(
    filter: BalanceCheckFilter,
  ): Promise<PaginatedResult<BalanceCheckEntity>>;
  /** Số dư cuối cùng của mỗi khoảng `bucketSeconds`, từ mốc `from`, cho từng đối tác. */
  abstract series(
    providerIds: string[],
    from: Date,
    bucketSeconds: number,
  ): Promise<BalancePoint[]>;
  abstract deleteOlderThan(cutoff: Date): Promise<number>;
}
