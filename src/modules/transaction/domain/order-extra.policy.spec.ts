import { OrderExtraField } from '@modules/provider-adapter/domain/order-fields';
import { resolveOrderExtra } from '@modules/transaction/domain/order-extra.policy';
import { InvalidOrderRequestError } from '@modules/transaction/domain/transaction.errors';

const fields: OrderExtraField[] = [
  {
    key: 'activationDate',
    label: 'Ngày kích hoạt',
    type: 'DATE',
    required: true,
    actions: ['ACTIVATE_SIM'],
    description: '',
  },
  {
    key: 'iccids',
    label: 'ICCID',
    type: 'TEXT_LIST',
    required: false,
    actions: [],
    description: '',
  },
  {
    key: 'quantity',
    label: 'Số lượng',
    type: 'NUMBER',
    required: false,
    actions: [],
    description: '',
  },
  {
    key: 'email',
    label: 'Email',
    type: 'TEXT',
    required: false,
    actions: [],
    description: '',
  },
];

const reject = (fn: () => unknown, message: string | RegExp) => {
  expect(fn).toThrow(InvalidOrderRequestError);
  expect(fn).toThrow(message);
};

describe('resolveOrderExtra', () => {
  it('chuẩn hoá đúng kiểu, bỏ trường rỗng', () => {
    expect(
      resolveOrderExtra(
        'ACTIVATE_SIM',
        {
          activationDate: ' 2026-10-15 ',
          iccids: '8988001',
          quantity: '1',
          email: '',
        },
        fields,
      ),
    ).toEqual({
      activationDate: '2026-10-15',
      iccids: ['8988001'],
      quantity: 1,
    });
  });

  it('thiếu trường bắt buộc của thao tác → lỗi; thao tác khác thì không bắt buộc', () => {
    reject(
      () => resolveOrderExtra('ACTIVATE_SIM', {}, fields),
      'bắt buộc có extra.activationDate (Ngày kích hoạt)',
    );
    expect(resolveOrderExtra('BUY_DATA', undefined, fields)).toEqual({});
  });

  it('ngày sai định dạng hoặc không có thật → lỗi', () => {
    for (const value of ['15/10/2026', '2026-02-30', 20261015]) {
      reject(
        () =>
          resolveOrderExtra('ACTIVATE_SIM', { activationDate: value }, fields),
        'YYYY-MM-DD',
      );
    }
  });

  it('trường lạ, hoặc trường không dùng cho thao tác này → lỗi', () => {
    reject(
      () =>
        resolveOrderExtra(
          'ACTIVATE_SIM',
          { activationDate: '2026-10-15', passport: 'X' },
          fields,
        ),
      'extra.passport không có trong',
    );
    reject(
      () =>
        resolveOrderExtra('BUY_DATA', { activationDate: '2026-10-15' }, fields),
      'extra.activationDate không dùng cho thao tác BUY_DATA',
    );
    reject(
      () => resolveOrderExtra('BUY_DATA', { x: 1 }, []),
      'không nhận trường thêm nào',
    );
  });

  it('sai kiểu số / danh sách → lỗi', () => {
    reject(
      () => resolveOrderExtra('BUY_DATA', { quantity: 'một' }, fields),
      'extra.quantity phải là số',
    );
    reject(
      () => resolveOrderExtra('BUY_DATA', { iccids: ['a', 3] }, fields),
      'extra.iccids phải là danh sách chuỗi',
    );
  });
});
