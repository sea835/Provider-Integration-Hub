import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterRequestDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Địa chỉ email đăng ký',
  })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Mật khẩu tài khoản (tối thiểu 6 ký tự)',
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;

  @ApiPropertyOptional({
    example: 'USER',
    description: 'Vai trò người dùng (ADMIN, USER, MANAGER)',
    enum: ['ADMIN', 'USER', 'MANAGER'],
    default: 'USER',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ADMIN', 'USER', 'MANAGER'], {
    message: 'Role chỉ có thể là ADMIN, USER hoặc MANAGER',
  })
  role?: string;
}
