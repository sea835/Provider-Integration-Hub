import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MerchantEntity } from '@modules/merchant/domain/merchant.entity';

export class MerchantResponse {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty() status: string;
  @ApiProperty({ description: '4 ký tự cuối của API key' }) apiKeyLast4: string;
  @ApiProperty({ type: [String] }) ipWhitelist: string[];
  @ApiPropertyOptional({ nullable: true }) callbackUrl: string | null;
  @ApiProperty() callbackEnabled: boolean;
  @ApiProperty() hasCallbackSecret: boolean;
  @ApiPropertyOptional({
    nullable: true,
    description: '4 ký tự cuối của khoá ký callback',
  })
  callbackSecretLast4: string | null;
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
    dto.callbackUrl = entity.callbackUrl;
    dto.callbackEnabled = entity.callbackEnabled;
    dto.hasCallbackSecret = Boolean(entity.callbackSecretEnc);
    dto.callbackSecretLast4 = entity.callbackSecretLast4;
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

export class MerchantCallbackSecretResponse extends MerchantResponse {
  @ApiProperty({ description: 'Khoá ký callback gốc, chỉ hiển thị một lần' })
  callbackSecret: string;

  static withSecret(
    entity: MerchantEntity,
    secret: string,
  ): MerchantCallbackSecretResponse {
    const dto = Object.assign(
      new MerchantCallbackSecretResponse(),
      MerchantResponse.fromEntity(entity),
    );
    dto.callbackSecret = secret;
    return dto;
  }
}
