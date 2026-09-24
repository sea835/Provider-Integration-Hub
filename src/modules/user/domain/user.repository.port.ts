import { UserEntity } from '@modules/user/domain/user.entity';
import {
  PaginationQueryDto,
  PaginatedResult,
} from '@common/base/pagination.dto';

/**
 * Output Port cho User Repository (Hexagonal Architecture).
 * Domain & Application layer chỉ phụ thuộc vào abstract class này,
 * hoàn toàn không biết chi tiết hạ tầng cơ sở dữ liệu (Drizzle / PostgreSQL).
 *
 * Abstract class được dùng làm runtime DI token trong NestJS.
 */
export abstract class UserRepositoryPort {
  abstract create(data: Partial<UserEntity>): Promise<UserEntity>;
  abstract findById(id: string): Promise<UserEntity | null>;
  abstract findAll(params?: PaginationQueryDto): Promise<UserEntity[]>;
  abstract findPaginated?(
    params?: PaginationQueryDto,
  ): Promise<PaginatedResult<UserEntity>>;
  abstract update(
    id: string,
    data: Partial<UserEntity>,
  ): Promise<UserEntity | null>;
  abstract delete(id: string): Promise<boolean>;
}
