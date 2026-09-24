import { Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { BaseService } from './base.service';

export abstract class BaseController<T> {
    constructor(protected readonly baseService: BaseService<T>) {}

    @Post()
    async create(@Body() createDto: any) {
        return this.baseService.create(createDto);
    }

    @Get()
    async findAll(@Query() query: any) {
        return this.baseService.findAll(query);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.baseService.findOne(id);
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() updateDto: any) {
        return this.baseService.update(id, updateDto);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.baseService.remove(id);
    }
}
