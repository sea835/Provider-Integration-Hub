import { normalizeVnPhone } from '@modules/transaction/domain/msisdn';
import { resolveOrderFields } from '@modules/transaction/domain/order-fields.policy';
import { InvalidOrderRequestError } from '@modules/transaction/domain/transaction.errors';

describe('normalizeVnPhone', () => {
  it.each([
    ['0914780285', '0914780285'],
    ['84914780285', '0914780285'],
    ['+84 914 780 285', '0914780285'],
    ['914780285', '0914780285'],
    ['01234567890', null],
    ['12345', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizeVnPhone(input)).toBe(expected);
  });
});

describe('resolveOrderFields', () => {
  it('BUY_DATA bắt buộc có SĐT và chuẩn hoá SĐT', () => {
    expect(
      resolveOrderFields({ action: 'BUY_DATA', phone: '84914780285' }),
    ).toEqual({ phone: '0914780285', serial: null });
    expect(() => resolveOrderFields({ action: 'BUY_DATA' })).toThrow(
      InvalidOrderRequestError,
    );
  });

  it('SĐT sai định dạng thì báo lỗi', () => {
    expect(() => resolveOrderFields({ action: 'TOPUP', phone: 'abc' })).toThrow(
      InvalidOrderRequestError,
    );
  });

  it('ACTIVATE_SIM không bắt buộc SĐT, serial được trim', () => {
    expect(
      resolveOrderFields({ action: 'ACTIVATE_SIM', serial: ' 8984 ' }),
    ).toEqual({ phone: null, serial: '8984' });
  });
});
