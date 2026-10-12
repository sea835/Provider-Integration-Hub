import { AlertChannelEntity } from '@modules/provider/domain/alert-channel.entity';

export abstract class AlertChannelRepositoryPort {
  abstract findByType(type: string): Promise<AlertChannelEntity | null>;
  /** Mỗi loại kênh chỉ có một dòng: tạo mới hoặc ghi đè. */
  abstract save(
    type: string,
    data: Pick<
      AlertChannelEntity,
      'enabled' | 'config' | 'encryptedSecrets'
    > & {
      updatedBy?: string;
    },
  ): Promise<AlertChannelEntity>;
}
