import { NotFoundException } from '@nestjs/common';
import { BaseRepository } from './base.repository';

export abstract class BaseService<T> {
    constructor(protected readonly repository: BaseRepository<T>) {}

    async create(createDto: Partial<T>): Promise<T> {
        return this.repository.create(createDto);
    }

    async findAll(query?: any): Promise<T[]> {
        return this.repository.findAll(query);
    }

    async findOne(id: string): Promise<T> {
        const record = await this.repository.findById(id);
        if (!record) {
            throw new NotFoundException(`Record with ID ${id} not found`);
        }
        return record;
    }

    async update(id: string, updateDto: Partial<T>): Promise<T> {
        await this.findOne(id);
        return this.repository.update(id, updateDto);
    }

    async remove(id: string): Promise<boolean> {
        await this.findOne(id);
        return this.repository.delete(id);
    }
}
