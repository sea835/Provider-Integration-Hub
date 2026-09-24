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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '@modules/user/application/user.service';
import { Role } from '@modules/user/domain/user-role';
import { CreateUserDto } from '@modules/user/presentation/dto/create-user.dto';
import { UpdateUserDto } from '@modules/user/presentation/dto/update-user.dto';
import { UserResponseDto } from '@modules/user/presentation/dto/user.response';
import { PaginationQueryDto } from '@common/base/base.repository';
import { Roles } from '@modules/auth/presentation/decorators/roles.decorator';

// Quản trị người dùng: chỉ ADMIN. Người dùng tự xem thông tin của mình qua GET /auth/me.
@Roles(Role.ADMIN)
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo người dùng mới' })
  async create(@Body() createDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.userService.create(createDto);
    return UserResponseDto.fromEntity(user);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách người dùng' })
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<UserResponseDto[]> {
    const users = await this.userService.findAll(query);
    return users.map((u) => UserResponseDto.fromEntity(u));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết người dùng theo ID' })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.userService.findOne(id);
    return UserResponseDto.fromEntity(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.update(id, updateDto);
    return UserResponseDto.fromEntity(user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa người dùng' })
  async remove(@Param('id') id: string): Promise<boolean> {
    return this.userService.remove(id);
  }
}
