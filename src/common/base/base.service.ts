import { NotFoundException } from '@nestjs/common';
import {
  PaginationQueryDto,
  PaginatedResult,
} from '@common/base/pagination.dto';

import { BaseRepositoryPort } from '@common/base/base.repository.port';

export { BaseRepositoryPort };
export type IBaseRepository<T> = BaseRepositoryPort<T>;

export abstract class BaseService<T> {
  constructor(protected readonly repository: BaseRepositoryPort<T>) {}

  async create(createDto: Partial<T>): Promise<T> {
    return this.repository.create(createDto);
  }

  async findAll(query?: PaginationQueryDto): Promise<T[]> {
    return this.repository.findAll(query);
  }

  async findPaginated(query?: PaginationQueryDto): Promise<PaginatedResult<T>> {
    if (!this.repository.findPaginated) {
      throw new Error('Repository does not support findPaginated');
    }
    return this.repository.findPaginated(query);
  }

  async findOne(id: string): Promise<T> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new NotFoundException(`Record with ID ${id} not found`);
    }
    return record;
  }

  async update(id: string, updateDto: Partial<T>): Promise<T> {
    const updated = await this.repository.update(id, updateDto);
    if (!updated) {
      throw new NotFoundException(`Record with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Record with ID ${id} not found`);
    }
    return deleted;
  }
}
