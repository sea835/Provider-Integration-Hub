import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '@common/base/pagination.dto';
import { SERIES_RANGES } from '@modules/provider/application/balance-check.service';
import type { SeriesRange } from '@modules/provider/application/balance-check.service';
import { BalanceCheckEntity } from '@modules/provider/domain/balance-check.entity';
import { BalancePoint } from '@modules/provider/domain/balance-check.repository.port';
import { CHECK_STATUS_VALUES } from '@modules/provider/domain/provider-status';

const RANGE_VALUES = Object.keys(SERIES_RANGES) as SeriesRange[];

export class BalanceCheckQuery extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Lọc theo đối tác' })
  @IsOptional()
  @IsUUID(undefined, { message: 'providerId không hợp lệ' })
  providerId?: string;

  @ApiPropertyOptional({ enum: CHECK_STATUS_VALUES })
  @IsOptional()
  @IsIn(CHECK_STATUS_VALUES, {
    message: 'status chỉ nhận SUCCESS hoặc FAILED',
  })
  status?: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'from phải là thời điểm ISO 8601' })
  from?: Date;

  @ApiPropertyOptional({ example: '2026-10-12T23:59:59.999Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'to phải là thời điểm ISO 8601' })
  to?: Date;
}

export class BalanceSeriesQuery {
  @ApiPropertyOptional({ enum: RANGE_VALUES, default: '24h' })
  @IsOptional()
  @IsIn(RANGE_VALUES, {
    message: `range chỉ nhận ${RANGE_VALUES.join(', ')}`,
  })
  range?: SeriesRange;

  @ApiPropertyOptional({
    description: 'Danh sách id đối tác, cách nhau dấu phẩy; bỏ trống = tất cả',
    example: 'id1,id2',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : (value as unknown),
  )
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true, message: 'providerIds không hợp lệ' })
  providerIds?: string[];
}

export class BalanceCheckResponse {
  @ApiProperty() id: string;
  @ApiProperty() providerId: string;
  @ApiProperty({ example: 'SUCCESS' }) status: string;
  @ApiProperty({ nullable: true }) balance: number | null;
  @ApiProperty({ nullable: true }) httpStatus: number | null;
  @ApiProperty({ nullable: true }) latencyMs: number | null;
  @ApiProperty({ nullable: true }) errorCode: string | null;
  @ApiProperty({ nullable: true }) errorMessage: string | null;
  @ApiProperty() checkedAt: Date;

  static fromEntity(check: BalanceCheckEntity): BalanceCheckResponse {
    const dto = new BalanceCheckResponse();
    dto.id = check.id;
    dto.providerId = check.providerId;
    dto.status = check.status;
    dto.balance = check.balance;
    dto.httpStatus = check.httpStatus;
    dto.latencyMs = check.latencyMs;
    dto.errorCode = check.errorCode;
    dto.errorMessage = check.errorMessage;
    dto.checkedAt = check.checkedAt;
    return dto;
  }
}

export class BalanceSeriesResponse {
  @ApiProperty() providerId: string;
  @ApiProperty({
    type: [Object],
    description: 'Các điểm { at, balance } theo thời gian tăng dần',
  })
  points: Array<{ at: Date; balance: number }>;

  static fromPoints(
    providerIds: string[],
    points: BalancePoint[],
  ): BalanceSeriesResponse[] {
    return providerIds.map((providerId) => ({
      providerId,
      points: points
        .filter((point) => point.providerId === providerId)
        .map(({ at, balance }) => ({ at, balance })),
    }));
  }
}
