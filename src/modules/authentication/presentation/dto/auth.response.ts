import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '@modules/user/presentation/dto/user.response';

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT Access Token dùng để gắn vào Authorization header',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh Token dùng để làm mới Access Token khi hết hạn',
  })
  refreshToken: string;

  @ApiProperty({
    example: 900,
    description: 'Thời gian sống của Access Token tính theo giây',
  })
  expiresIn: number;

  @ApiProperty({
    type: () => UserResponseDto,
    description: 'Thông tin tài khoản người dùng',
  })
  user: UserResponseDto;
}
