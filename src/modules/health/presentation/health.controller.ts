import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from '@modules/health/application/health.service';
import { Public } from '@modules/auth/presentation/decorators/public.decorator';
import {
  LivenessResponseDto,
  ReadinessResponseDto,
} from '@modules/health/presentation/dto/health.response';

// Probe của Docker / Kubernetes gọi liên tục từ cùng một IP: không yêu cầu token, không tính rate limit
@Public()
@SkipThrottle()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness: tiến trình còn sống' })
  live(): LivenessResponseDto {
    return LivenessResponseDto.fromResult(this.healthService.getLiveness());
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: sẵn sàng nhận traffic (kiểm tra DB)' })
  async ready(): Promise<ReadinessResponseDto> {
    const result = await this.healthService.checkReadiness();
    return ReadinessResponseDto.fromResult(result);
  }
}
