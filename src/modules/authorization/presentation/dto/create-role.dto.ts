import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Mã định danh vai trò (chữ in hoa, không dấu cách)',
    example: 'SUPPORT',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Mã vai trò chỉ được chứa chữ in hoa, số và dấu gạch dưới',
  })
  code: string;

  @ApiProperty({
    description: 'Tên hiển thị của vai trò',
    example: 'Chuyên viên Hỗ trợ',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Mô tả vai trò',
    example: 'Hỗ trợ khách hàng và tra cứu thông tin',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
