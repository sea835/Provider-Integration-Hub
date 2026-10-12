import { Injectable } from '@nestjs/common';
import { SecretCipherPort } from '@common/crypto/secret-cipher.port';
import { LoggerPort, LogLayer } from '@common/logger';
import { AlertChannelType } from '@modules/provider/domain/alert-channel.entity';
import { AlertChannelRepositoryPort } from '@modules/provider/domain/alert-channel.repository.port';
import {
  AlertNotifierPort,
  DeliveryResult,
  TelegramTarget,
} from '@modules/provider/domain/alert-notifier.port';

const SEND_TIMEOUT_MS = 10_000;
const MAX_DETAIL_LENGTH = 300;

/**
 * Gửi cảnh báo vào một nhóm Telegram qua Bot API. Cấu hình lấy từ bảng `alert_channels`
 * (đặt trên giao diện); chưa có dòng nào thì dùng `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
 * Đọc lại mỗi lần gửi nên API và worker luôn dùng cấu hình mới nhất.
 */
@Injectable()
export class TelegramNotifier extends AlertNotifierPort {
  private readonly logger: LoggerPort;

  constructor(
    private readonly channels: AlertChannelRepositoryPort,
    private readonly cipher: SecretCipherPort,
    logger: LoggerPort,
  ) {
    super();
    this.logger = logger.child(
      LogLayer.INFRASTRUCTURE,
      'Provider',
      TelegramNotifier.name,
    );
  }

  async send(text: string): Promise<DeliveryResult> {
    let target: TelegramTarget | null;
    try {
      target = await this.resolve();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn('Không đọc được cấu hình Telegram', { reason: detail });
      return { status: 'FAILED', detail };
    }
    if (!target) return { status: 'DISABLED' };
    return this.sendTo(target, text);
  }

  async sendTo(target: TelegramTarget, text: string): Promise<DeliveryResult> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${target.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: target.chatId,
            text,
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        },
      );
      if (response.ok) return { status: 'SENT' };
      const detail = await this.describe(response);
      this.logger.warn('Telegram từ chối tin nhắn cảnh báo', {
        status: response.status,
        detail,
      });
      return { status: 'FAILED', detail };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn('Không gửi được cảnh báo Telegram', { reason: detail });
      return {
        status: 'FAILED',
        detail: `Không kết nối được tới Telegram: ${detail}`,
      };
    }
  }

  /** Cấu hình đang có hiệu lực; null = chưa cấu hình hoặc đang tắt. */
  private async resolve(): Promise<TelegramTarget | null> {
    const channel = await this.channels.findByType(AlertChannelType.TELEGRAM);
    if (!channel) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
      const chatId = process.env.TELEGRAM_CHAT_ID ?? '';
      return botToken && chatId ? { botToken, chatId } : null;
    }
    if (!channel.enabled || !channel.encryptedSecrets) return null;
    const botToken = this.cipher.decrypt(channel.encryptedSecrets).botToken;
    const chatId = channel.config.chatId;
    return typeof botToken === 'string' &&
      botToken &&
      typeof chatId === 'string' &&
      chatId
      ? { botToken, chatId }
      : null;
  }

  private async describe(response: Response): Promise<string> {
    const raw = (await response.text()).slice(0, MAX_DETAIL_LENGTH);
    try {
      const body = JSON.parse(raw) as { description?: unknown };
      if (typeof body.description === 'string') {
        return `Telegram trả lỗi ${response.status}: ${body.description}`;
      }
    } catch {
      return `Telegram trả lỗi ${response.status}: ${raw}`;
    }
    return `Telegram trả lỗi ${response.status}`;
  }
}
