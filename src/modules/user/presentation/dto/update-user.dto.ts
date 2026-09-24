import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ROLE_VALUES } from '@modules/user/domain/user-role';
import type { RoleType } from '@modules/user/domain/user-role';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'new-email@example.com',
    description: 'Địa chỉ email mới của người dùng',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @ApiPropertyOptional({
    example: 'NewSecret123!',
    description: 'Mật khẩu mới của người dùng (tối thiểu 6 ký tự)',
    minLength: 6,
  })
  @IsOptional()
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password?: string;

  @ApiPropertyOptional({
    example: 'MANAGER',
    description: 'Vai trò mới của người dùng',
    enum: ROLE_VALUES,
  })
  @IsOptional()
  @IsIn(ROLE_VALUES, {
    message: 'Role chỉ có thể là ADMIN, USER hoặc MANAGER',
  })
  role?: RoleType;
}
