import { LoggerPort } from '@common/logger';
import { AlertChannelService } from '@modules/provider/application/alert-channel.service';
import { AlertChannelEntity } from '@modules/provider/domain/alert-channel.entity';
import { AlertChannelRepositoryPort } from '@modules/provider/domain/alert-channel.repository.port';
import {
  AlertNotifierPort,
  TelegramTarget,
} from '@modules/provider/domain/alert-notifier.port';
import { PlainCipher } from '@modules/provider/infrastructure/http-config/http-config.test-support';

const TOKEN = '123456789:AAExampleTokenForUnitTests_abcdefghijk';

function setup() {
  let row: AlertChannelEntity | null = null;
  const sentTo: Array<{ target: TelegramTarget; text: string }> = [];
  const channels: AlertChannelRepositoryPort = {
    findByType: () => Promise.resolve(row),
    save: (type, data) => {
      row = {
        ...(row ?? {}),
        ...data,
        type,
        updatedAt: new Date('2026-10-12T03:00:00.000Z'),
      } as AlertChannelEntity;
      return Promise.resolve(row);
    },
  };
  const notifier = {
    sendTo: (target: TelegramTarget, text: string) => {
      sentTo.push({ target, text });
      return Promise.resolve({ status: 'SENT' as const });
    },
  } as unknown as AlertNotifierPort;
  const logger = {
    child: () => logger,
    info: jest.fn(),
  } as unknown as LoggerPort;
  const service = new AlertChannelService(
    channels,
    new PlainCipher(),
    notifier,
    logger,
  );
  return { service, sentTo, stored: () => row };
}

describe('AlertChannelService', () => {
  const env = { ...process.env };
  beforeEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });
  afterAll(() => {
    process.env = env;
  });

  it('chưa cấu hình gì: NONE; có biến môi trường: ENV', async () => {
    const t = setup();
    await expect(t.service.getTelegram()).resolves.toMatchObject({
      source: 'NONE',
      enabled: false,
      hasBotToken: false,
    });
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    process.env.TELEGRAM_CHAT_ID = '-1001234567890';
    await expect(t.service.getTelegram()).resolves.toMatchObject({
      source: 'ENV',
      enabled: true,
      chatId: '-1001234567890',
      hasBotToken: true,
    });
  });

  it('lưu token đã mã hoá, không trả token; bỏ trống token ở lần sau thì giữ nguyên', async () => {
    const t = setup();
    const saved = await t.service.updateTelegram(
      { enabled: true, chatId: '-1001234567890', botToken: TOKEN },
      'u1',
    );
    expect(saved).toMatchObject({
      source: 'DATABASE',
      enabled: true,
      chatId: '-1001234567890',
      hasBotToken: true,
    });
    expect(JSON.stringify(saved)).not.toContain(TOKEN);
    expect(t.stored()?.encryptedSecrets).toBe(`enc:{"botToken":"${TOKEN}"}`);

    await t.service.updateTelegram({ chatId: '@kenh_canh_bao', botToken: '' });
    expect(t.stored()?.config).toEqual({ chatId: '@kenh_canh_bao' });
    expect(t.stored()?.encryptedSecrets).toBe(`enc:{"botToken":"${TOKEN}"}`);
  });

  it('từ chối Chat ID / token sai dạng và bật kênh khi còn thiếu thông tin', async () => {
    const t = setup();
    await expect(
      t.service.updateTelegram({ chatId: 'nhom canh bao', botToken: TOKEN }),
    ).rejects.toThrow('Chat ID là dãy số');
    await expect(
      t.service.updateTelegram({ chatId: '-1001234567890', botToken: 'abc' }),
    ).rejects.toThrow('Bot token có dạng');
    await expect(
      t.service.updateTelegram({ enabled: true, chatId: '-1001234567890' }),
    ).rejects.toThrow('Cần nhập đủ bot token và Chat ID');
    await expect(
      t.service.updateTelegram({ enabled: false, chatId: '-1001234567890' }),
    ).resolves.toMatchObject({ enabled: false, hasBotToken: false });
  });

  it('gửi tin thử: ưu tiên giá trị đang soạn, thiếu thì dùng giá trị đã lưu', async () => {
    const t = setup();
    await expect(t.service.testTelegram({}, 'admin@pq.com')).resolves.toEqual({
      status: 'DISABLED',
      detail: 'Chưa có đủ bot token và Chat ID để gửi tin thử',
    });
    await t.service.updateTelegram({
      enabled: true,
      chatId: '-1001234567890',
      botToken: TOKEN,
    });
    await t.service.testTelegram({ chatId: '-200999' }, 'admin@pq.com');
    expect(t.sentTo[0].target).toEqual({ botToken: TOKEN, chatId: '-200999' });
    expect(t.sentTo[0].text).toContain('admin@pq.com');
  });
});
