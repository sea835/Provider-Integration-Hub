import {
  PaginationQueryDto,
  PaginatedResult,
} from '@common/base/pagination.dto';

export abstract class BaseRepositoryPort<T> {
  abstract create(data: Partial<T>): Promise<T>;
  abstract findById(id: string): Promise<T | null>;
  abstract findAll(query?: PaginationQueryDto): Promise<T[]>;
  abstract findPaginated?(
    query?: PaginationQueryDto,
  ): Promise<PaginatedResult<T>>;
  abstract update(id: string, data: Partial<T>): Promise<T | null>;
  abstract delete(id: string): Promise<boolean>;
}
