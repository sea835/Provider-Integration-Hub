import { Injectable } from '@nestjs/common';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';
import { LoggerPort, LogLayer } from '@common/logger';
import { AlertChannelType } from '@modules/provider/domain/alert-channel.entity';
import { AlertChannelInvalidError } from '@modules/provider/domain/alert-channel.errors';
import { AlertChannelRepositoryPort } from '@modules/provider/domain/alert-channel.repository.port';
import {
  AlertNotifierPort,
  DeliveryResult,
} from '@modules/provider/domain/alert-notifier.port';

/** Id nhóm / kênh (số, thường âm) hoặc `@tên_kênh`. */
const CHAT_ID = /^(-?\d{4,20}|@[A-Za-z][A-Za-z0-9_]{3,31})$/;
const BOT_TOKEN = /^\d{5,15}:[A-Za-z0-9_-]{20,80}$/;

/** DATABASE: đặt trên giao diện. ENV: lấy từ biến môi trường. NONE: chưa cấu hình. */
export type TelegramSource = 'DATABASE' | 'ENV' | 'NONE';

export interface TelegramSettings {
  source: TelegramSource;
  enabled: boolean;
  chatId: string;
  /** Không bao giờ trả token; chỉ cho biết đã có hay chưa. */
  hasBotToken: boolean;
  updatedAt: Date | null;
}

export interface UpdateTelegramInput {
  enabled?: boolean;
  chatId?: string;
  /** Bỏ qua hoặc chuỗi rỗng = giữ token đang lưu. */
  botToken?: string;
}

@Injectable()
export class AlertChannelService {
  private readonly logger: LoggerPort;

  constructor(
    private readonly channels: AlertChannelRepositoryPort,
    private readonly cipher: SecretCipherPort,
    private readonly notifier: AlertNotifierPort,
    logger: LoggerPort,
  ) {
    this.logger = logger.child(
      LogLayer.APPLICATION,
      'Provider',
      AlertChannelService.name,
    );
  }

  async getTelegram(): Promise<TelegramSettings> {
    const channel = await this.channels.findByType(AlertChannelType.TELEGRAM);
    if (channel) {
      return {
        source: 'DATABASE',
        enabled: channel.enabled,
        chatId: this.chatIdOf(channel.config),
        hasBotToken: Boolean(this.storedToken(channel.encryptedSecrets)),
        updatedAt: channel.updatedAt,
      };
    }
    const chatId = process.env.TELEGRAM_CHAT_ID ?? '';
    const hasBotToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
    const fromEnv = hasBotToken && Boolean(chatId);
    return {
      source: fromEnv ? 'ENV' : 'NONE',
      enabled: fromEnv,
      chatId,
      hasBotToken,
      updatedAt: null,
    };
  }

  async updateTelegram(
    input: UpdateTelegramInput,
    userId?: string,
  ): Promise<TelegramSettings> {
    const current = await this.channels.findByType(AlertChannelType.TELEGRAM);
    const chatId = (
      input.chatId ?? this.chatIdOf(current?.config ?? {})
    ).trim();
    const botToken =
      input.botToken?.trim() ||
      this.storedToken(current?.encryptedSecrets ?? null);
    const enabled = input.enabled ?? current?.enabled ?? true;

    if (chatId && !CHAT_ID.test(chatId)) {
      throw new AlertChannelInvalidError(
        'Chat ID là dãy số (nhóm thường bắt đầu bằng dấu -) hoặc @tên_kênh',
      );
    }
    if (input.botToken?.trim() && !BOT_TOKEN.test(input.botToken.trim())) {
      throw new AlertChannelInvalidError(
        'Bot token có dạng 123456789:AA..., lấy từ @BotFather',
      );
    }
    if (enabled && (!chatId || !botToken)) {
      throw new AlertChannelInvalidError(
        'Cần nhập đủ bot token và Chat ID trước khi bật kênh Telegram',
      );
    }

    await this.channels.save(AlertChannelType.TELEGRAM, {
      enabled,
      config: { chatId },
      encryptedSecrets: botToken ? this.cipher.encrypt({ botToken }) : null,
      updatedBy: userId,
    });
    this.logger.info('Đã cập nhật kênh Telegram', { enabled, userId });
    return this.getTelegram();
  }

  /** Gửi một tin thử; giá trị đang soạn (nếu có) được ưu tiên hơn giá trị đã lưu. */
  async testTelegram(
    draft: Pick<UpdateTelegramInput, 'chatId' | 'botToken'>,
    sender: string,
  ): Promise<DeliveryResult> {
    const current = await this.channels.findByType(AlertChannelType.TELEGRAM);
    const chatId =
      draft.chatId?.trim() ||
      this.chatIdOf(current?.config ?? {}) ||
      (current ? '' : (process.env.TELEGRAM_CHAT_ID ?? ''));
    const botToken =
      draft.botToken?.trim() ||
      this.storedToken(current?.encryptedSecrets ?? null) ||
      (current ? '' : (process.env.TELEGRAM_BOT_TOKEN ?? ''));
    if (!chatId || !botToken) {
      return {
        status: 'DISABLED',
        detail: 'Chưa có đủ bot token và Chat ID để gửi tin thử',
      };
    }
    return this.notifier.sendTo(
      { botToken, chatId },
      `✅ Tin thử từ Provider Integration Hub\nKênh cảnh báo số dư đã kết nối. Người gửi: ${sender}`,
    );
  }

  private chatIdOf(config: Record<string, unknown>): string {
    return typeof config.chatId === 'string' ? config.chatId : '';
  }

  private storedToken(encrypted: string | null): string {
    if (!encrypted) return '';
    try {
      const token = this.cipher.decrypt(encrypted).botToken;
      return typeof token === 'string' ? token : '';
    } catch {
      return '';
    }
  }
}
