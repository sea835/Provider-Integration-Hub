import { ApiProperty } from '@nestjs/swagger';
import type {
  DependencyCheck,
  LivenessResult,
  ReadinessResult,
} from '@modules/health/application/health.service';

export class LivenessResponseDto {
  @ApiProperty({ example: 'ok', description: 'Tiến trình đang chạy' })
  status: 'ok';

  @ApiProperty({ example: 3600, description: 'Thời gian chạy (giây)' })
  uptimeSeconds: number;

  @ApiProperty({ example: '2026-09-24T08:00:00.000Z' })
  timestamp: string;

  static fromResult(result: LivenessResult): LivenessResponseDto {
    const dto = new LivenessResponseDto();
    dto.status = result.status;
    dto.uptimeSeconds = result.uptimeSeconds;
    dto.timestamp = new Date().toISOString();
    return dto;
  }
}

export class DependencyCheckDto {
  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  status: 'up' | 'down';

  @ApiProperty({ example: 3, description: 'Thời gian phản hồi (ms)' })
  latencyMs: number;

  static fromCheck(check: DependencyCheck): DependencyCheckDto {
    const dto = new DependencyCheckDto();
    dto.status = check.status;
    dto.latencyMs = check.latencyMs;
    return dto;
  }
}

export class ReadinessChecksDto {
  @ApiProperty({ type: () => DependencyCheckDto })
  database: DependencyCheckDto;
}

export class ReadinessResponseDto {
  @ApiProperty({ example: 'ok', description: 'Sẵn sàng nhận traffic' })
  status: 'ok';

  @ApiProperty({ type: () => ReadinessChecksDto })
  checks: ReadinessChecksDto;

  @ApiProperty({ example: '2026-09-24T08:00:00.000Z' })
  timestamp: string;

  static fromResult(result: ReadinessResult): ReadinessResponseDto {
    const dto = new ReadinessResponseDto();
    dto.status = result.status;
    dto.checks = {
      database: DependencyCheckDto.fromCheck(result.checks.database),
    };
    dto.timestamp = new Date().toISOString();
    return dto;
  }
}
