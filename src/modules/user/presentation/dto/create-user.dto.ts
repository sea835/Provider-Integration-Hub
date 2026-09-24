import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ROLE_VALUES } from '@modules/user/domain/user-role';
import type { RoleType } from '@modules/user/domain/user-role';

export class CreateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Địa chỉ email của người dùng',
  })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({
    example: 'Secret123!',
    description: 'Mật khẩu người dùng (tối thiểu 6 ký tự)',
    minLength: 6,
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @ApiPropertyOptional({
    example: 'USER',
    description: 'Vai trò người dùng',
    enum: ROLE_VALUES,
    default: 'USER',
  })
  @IsOptional()
  @IsIn(ROLE_VALUES, {
    message: 'Role chỉ có thể là ADMIN, USER hoặc MANAGER',
  })
  role?: RoleType;
}
