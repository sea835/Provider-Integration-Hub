import { ApiProperty } from '@nestjs/swagger';
import { levelOf } from '@modules/provider/domain/alert-policy';
import {
  BalanceProbeStepView,
  LoginProbeResult,
  ProbeResult,
} from '@modules/provider/domain/balance-probe.port';
import type {
  ProviderConfig,
  ProviderSamples,
} from '@modules/provider/domain/provider-config';
import { ProviderEntity } from '@modules/provider/domain/provider.entity';
import { FAILURE_ALERT_THRESHOLD } from '@modules/provider/domain/provider-status';

export class ProviderResponse {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'VIETTEL_DATA' }) code: string;
  @ApiProperty() name: string;
  @ApiProperty({ example: 'ACTIVE' }) status: string;
  @ApiProperty({ type: Object }) config: ProviderConfig;
  @ApiProperty({
    type: Object,
    description:
      'Phản hồi mẫu đã lưu của từng lời gọi (login, balance), đã che bí mật',
  })
  samples: ProviderSamples;
  @ApiProperty({
    type: [String],
    description: 'Tên các bí mật đã lưu (không bao giờ trả giá trị)',
  })
  secretKeys: string[];
  @ApiProperty() unitMultiplier: number;
  @ApiProperty() intervalMinutes: number;
  @ApiProperty({ nullable: true }) warningThreshold: number | null;
  @ApiProperty({ nullable: true }) criticalThreshold: number | null;
  @ApiProperty() cooldownMinutes: number;
  @ApiProperty({ nullable: true }) currentBalance: number | null;
  @ApiProperty({
    example: 'OK',
    description:
      'Mức theo số dư hiện tại so với ngưỡng: OK / WARNING / CRITICAL',
  })
  level: string;
  @ApiProperty() consecutiveFailures: number;
  @ApiProperty({ description: 'Đang lỗi kết nối (lỗi liên tiếp đủ ngưỡng)' })
  connectionFailing: boolean;
  @ApiProperty({ nullable: true }) lastCheckedAt: Date | null;
  @ApiProperty({ nullable: true, example: 'SUCCESS' }) lastStatus:
    string | null;
  @ApiProperty({
    type: [String],
    description: 'Những gì còn thiếu để bật quét; rỗng = sẵn sàng',
  })
  readinessIssues: string[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(
    provider: ProviderEntity,
    secretKeys: string[],
    readinessIssues: string[],
  ): ProviderResponse {
    const dto = new ProviderResponse();
    dto.id = provider.id;
    dto.code = provider.code;
    dto.name = provider.name;
    dto.status = provider.status;
    dto.config = provider.config;
    dto.samples = provider.samples ?? {};
    dto.secretKeys = secretKeys;
    dto.unitMultiplier = provider.unitMultiplier;
    dto.intervalMinutes = provider.intervalMinutes;
    dto.warningThreshold = provider.warningThreshold;
    dto.criticalThreshold = provider.criticalThreshold;
    dto.cooldownMinutes = provider.cooldownMinutes;
    dto.currentBalance = provider.currentBalance;
    dto.level = levelOf(
      provider.currentBalance,
      provider.warningThreshold,
      provider.criticalThreshold,
    );
    dto.consecutiveFailures = provider.consecutiveFailures;
    dto.connectionFailing =
      provider.consecutiveFailures >= FAILURE_ALERT_THRESHOLD;
    dto.lastCheckedAt = provider.lastCheckedAt;
    dto.lastStatus = provider.lastStatus;
    dto.readinessIssues = readinessIssues;
    dto.createdAt = provider.createdAt;
    dto.updatedAt = provider.updatedAt;
    return dto;
  }
}

export class TestConnectionResponse {
  @ApiProperty() ok: boolean;
  @ApiProperty({ nullable: true }) balance: number | null;
  @ApiProperty({ nullable: true, description: 'Giá trị gốc đọc từ phản hồi' })
  rawValue: string | null;
  @ApiProperty({ nullable: true }) httpStatus: number | null;
  @ApiProperty({ nullable: true }) latencyMs: number | null;
  @ApiProperty({ nullable: true }) errorCode: string | null;
  @ApiProperty({ nullable: true }) errorMessage: string | null;
  @ApiProperty({ nullable: true, description: 'Token lấy được, đã che bớt' })
  tokenPreview: string | null;
  @ApiProperty({
    type: [Object],
    description: 'Từng lời gọi (đăng nhập, số dư), đã che bí mật và token',
  })
  steps: BalanceProbeStepView[];

  static fromResult(
    result: ProbeResult | LoginProbeResult,
  ): TestConnectionResponse {
    const dto = new TestConnectionResponse();
    dto.ok = result.ok;
    dto.balance = result.ok && 'balance' in result ? result.balance : null;
    dto.rawValue = result.ok && 'rawValue' in result ? result.rawValue : null;
    dto.httpStatus = result.httpStatus;
    dto.latencyMs = result.latencyMs;
    dto.errorCode = result.ok ? null : result.errorCode;
    dto.errorMessage = result.ok ? null : result.errorMessage;
    dto.tokenPreview = result.tokenPreview;
    dto.steps = result.steps;
    return dto;
  }
}
