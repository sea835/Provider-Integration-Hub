import { ApiProperty } from '@nestjs/swagger';
import { MerchantEntity } from '@modules/merchant/domain/merchant.entity';

export class MerchantResponse {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty() status: string;
  @ApiProperty({ description: '4 ký tự cuối của API key' }) apiKeyLast4: string;
  @ApiProperty({ type: [String] }) ipWhitelist: string[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: MerchantEntity): MerchantResponse {
    const dto = new MerchantResponse();
    dto.id = entity.id;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.status = entity.status;
    dto.apiKeyLast4 = entity.apiKeyLast4;
    dto.ipWhitelist = entity.ipWhitelist;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export class MerchantWithKeyResponse extends MerchantResponse {
  @ApiProperty({ description: 'API key gốc, chỉ hiển thị một lần' })
  apiKey: string;

  static withKey(
    entity: MerchantEntity,
    apiKey: string,
  ): MerchantWithKeyResponse {
    const dto = Object.assign(
      new MerchantWithKeyResponse(),
      MerchantResponse.fromEntity(entity),
    );
    dto.apiKey = apiKey;
    return dto;
  }
}
