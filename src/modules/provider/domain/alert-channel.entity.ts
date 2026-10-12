import { BaseEntity } from '@common/base/base.entity';

export const AlertChannelType = { TELEGRAM: 'TELEGRAM' } as const;
export type AlertChannelTypeValue =
  (typeof AlertChannelType)[keyof typeof AlertChannelType];

/** Subject CASL của trang cài đặt kênh thông báo. */
export const ALERT_CHANNEL_SUBJECT = 'AlertChannel';

export class AlertChannelEntity extends BaseEntity {
  type: string;
  enabled: boolean;
  /** Phần không bí mật, vd `{ chatId }`. */
  config: Record<string, unknown>;
  /** Phần bí mật đã mã hoá, vd `{ botToken }`. */
  encryptedSecrets: string | null;
}
