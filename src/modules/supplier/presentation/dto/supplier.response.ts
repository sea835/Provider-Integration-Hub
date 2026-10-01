import { ApiProperty } from '@nestjs/swagger';
import { SupplierEntity } from '@modules/supplier/domain/supplier.entity';

export class SupplierResponse {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty() adapterType: string;
  @ApiProperty() status: string;
  @ApiProperty() version: number;
  @ApiProperty() baseUrl: string;
  @ApiProperty() submitTimeoutMs: number;
  @ApiProperty() queryTimeoutMs: number;
  @ApiProperty() concurrency: number;
  @ApiProperty() rateLimitPerMin: number;
  @ApiProperty({ type: [Number] }) pollScheduleSec: number[];
  @ApiProperty() maxWaitSec: number;
  @ApiProperty() maxResubmit: number;
  @ApiProperty({ type: [String] }) callbackIpWhitelist: string[];
  @ApiProperty({ type: Object }) params: Record<string, unknown>;
  @ApiProperty({
    description: 'Đã có secret hay chưa (secret không bao giờ được trả ra)',
  })
  hasSecrets: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: SupplierEntity): SupplierResponse {
    const dto = new SupplierResponse();
    dto.id = entity.id;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.adapterType = entity.adapterType;
    dto.status = entity.status;
    dto.version = entity.version;
    dto.baseUrl = entity.baseUrl;
    dto.submitTimeoutMs = entity.submitTimeoutMs;
    dto.queryTimeoutMs = entity.queryTimeoutMs;
    dto.concurrency = entity.concurrency;
    dto.rateLimitPerMin = entity.rateLimitPerMin;
    dto.pollScheduleSec = entity.pollScheduleSec;
    dto.maxWaitSec = entity.maxWaitSec;
    dto.maxResubmit = entity.maxResubmit;
    dto.callbackIpWhitelist = entity.callbackIpWhitelist;
    dto.params = entity.params;
    dto.hasSecrets = Boolean(entity.secretsEnc);
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
