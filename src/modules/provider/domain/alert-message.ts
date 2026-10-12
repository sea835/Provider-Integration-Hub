import { AlertEvent } from '@modules/provider/domain/alert-policy';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export function formatVnd(value: number): string {
  return `${money.format(value)} VNĐ`;
}

/** Nội dung tin nhắn cảnh báo (văn bản thuần) cho một sự kiện của một đối tác. */
export function alertMessage(
  provider: { code: string; name: string },
  event: AlertEvent,
): string {
  const who = `${provider.name} (${provider.code})`;
  switch (event.kind) {
    case 'LEVEL': {
      const head =
        event.level === 'CRITICAL'
          ? '🔴 KHẨN CẤP - SỐ DƯ SẮP CẠN'
          : '🟠 CẢNH BÁO SỐ DƯ THẤP';
      const limit =
        event.level === 'CRITICAL' ? 'ngưỡng khẩn cấp' : 'ngưỡng cảnh báo sớm';
      return [
        event.reminder ? `${head} (nhắc lại)` : head,
        `${who} còn ${formatVnd(event.balance)}, dưới ${limit} ${formatVnd(event.threshold)}.`,
      ].join('\n');
    }
    case 'RECOVERED':
      return `🟢 ${who} đã được nạp, số dư hiện tại ${formatVnd(event.balance)}`;
    case 'CONNECTION_FAILED':
      return [
        '⚠️ LỖI KẾT NỐI',
        `${who}: kiểm tra số dư thất bại ${event.failures} lần liên tiếp.`,
        `Lỗi gần nhất: ${event.message}`,
      ].join('\n');
    case 'RECONNECTED':
      return `✅ ${who} đã kết nối lại, số dư hiện tại ${formatVnd(event.balance)}`;
  }
}
