import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { UserService } from '@modules/user/application/user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user.response';
import { PaginationQueryDto } from '@common/base/base.repository';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() createDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.userService.create(createDto);
    return UserResponseDto.fromEntity(user);
  }

  @Get()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<UserResponseDto[]> {
    const users = await this.userService.findAll(query);
    return users.map((u) => UserResponseDto.fromEntity(u));
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.userService.findOne(id);
    return UserResponseDto.fromEntity(user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.update(id, updateDto);
    return UserResponseDto.fromEntity(user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<boolean> {
    return this.userService.remove(id);
  }
}
