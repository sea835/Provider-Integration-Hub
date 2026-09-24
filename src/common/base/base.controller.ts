import { Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { BaseService } from './base.service';
import { PaginationQueryDto } from './base.repository';

export abstract class BaseController<T> {
  constructor(protected readonly baseService: BaseService<T>) {}

  @Post()
  async create(@Body() createDto: Partial<T>) {
    return this.baseService.create(createDto);
  }

  @Get()
  async findAll(@Query() query: PaginationQueryDto) {
    return this.baseService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.baseService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: Partial<T>) {
    return this.baseService.update(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.baseService.remove(id);
  }
}
