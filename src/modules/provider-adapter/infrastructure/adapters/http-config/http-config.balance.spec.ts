import { readBalance } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';
import { HttpConfigParams } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import {
  parseParams,
  readinessIssues,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';

const http = (body: unknown, status = 200): HttpResult => ({
  ok: true,
  status,
  body,
  rawText: JSON.stringify(body),
  durationMs: 4,
});

const momoBalance = (availBalance: number) => ({
  error: 862000000,
  message: 'Success',
  time: 1787592191,
  data: { availBalance, pendBalance: 100000, currency: 'VND' },
});

function momo(
  minimum = '',
  vars: Record<string, string> = {},
): HttpConfigParams {
  const { params, issues } = parseParams({
    vars,
    spec: {
      balance: {
        enabled: true,
        beforeSubmit: true,
        request: { method: 'GET', path: '/telco/v1/partner/balance' },
        success: [
          { path: 'http.status', operator: 'IN', values: ['2xx'] },
          { path: 'body.error', operator: 'IN', values: ['862000000'] },
        ],
        available: 'body.data.availBalance',
        pending: 'body.data.pendBalance',
        currency: 'body.data.currency',
        minimum,
      },
    },
  });
  expect(issues).toEqual([]);
  return params;
}

describe('Số dư tại nhà cung cấp (MoMo B2B)', () => {
  it('đọc số dư khả dụng, tạm giữ, đơn vị; đủ khi ≥ mức tối thiểu', () => {
    expect(
      readBalance(momo('100000'), http(momoBalance(5000000)), null),
    ).toEqual({
      ok: true,
      available: 5000000,
      pending: 100000,
      currency: 'VND',
      minimum: 100000,
      sufficient: true,
      message: 'Số dư khả dụng 5.000.000 VND, đủ (cần tối thiểu 100.000 VND)',
    });
  });

  it('dưới mức tối thiểu → không đủ', () => {
    expect(
      readBalance(momo('100000'), http(momoBalance(50000)), null),
    ).toMatchObject({
      sufficient: false,
      message:
        'Số dư khả dụng 50.000 VND, không đủ (cần tối thiểu 100.000 VND)',
    });
  });

  it('không đặt mức tối thiểu → chỉ cần lớn hơn 0', () => {
    expect(readBalance(momo(), http(momoBalance(1)), null).sufficient).toBe(
      true,
    );
    expect(readBalance(momo(), http(momoBalance(0)), null).sufficient).toBe(
      false,
    );
  });

  it('mức tối thiểu lấy từ biến hoặc trường thêm của đơn', () => {
    expect(
      readBalance(
        momo('{{vars.minBalance}}', { minBalance: '200000' }),
        http(momoBalance(150000)),
        null,
      ).sufficient,
    ).toBe(false);
    const byOrder = readBalance(
      momo('{{order.extra.amount}}'),
      http(momoBalance(150000)),
      {
        transCode: 'T1',
        action: 'BUY_DATA',
        packageCode: 'V90C',
        phone: '0912345678',
        serial: null,
        supplierTransId: null,
        extra: { amount: 85000 },
      },
    );
    expect(byOrder).toMatchObject({ minimum: 85000, sufficient: true });
  });

  it('không chắc thì chưa rõ (Hub vẫn gửi đơn): MoMo báo lỗi, data null, lỗi mạng', () => {
    expect(
      readBalance(
        momo('100000'),
        http({
          error: 862800001,
          message: 'Agent account not found',
          data: null,
        }),
        null,
      ),
    ).toMatchObject({
      sufficient: null,
      message: expect.stringContaining('Agent account not found') as string,
    });
    expect(
      readBalance(
        momo('100000'),
        http({ error: 862000000, message: 'Success', data: null }),
        null,
      ).sufficient,
    ).toBeNull();
    expect(
      readBalance(
        momo('100000'),
        {
          ok: false,
          kind: 'TIMEOUT',
          message: 'Hết thời gian chờ',
          durationMs: 10000,
        },
        null,
      ).sufficient,
    ).toBeNull();
  });

  it('cảnh báo cấu hình thiếu đường dẫn, thiếu trường số dư, mức tối thiểu không phải số', () => {
    const { params } = parseParams({
      spec: { balance: { enabled: true, minimum: 'một trăm' } },
    });
    expect(readinessIssues(params)).toEqual(
      expect.arrayContaining([
        'Số dư: chưa nhập đường dẫn API số dư',
        'Số dư: chưa chọn trường số dư khả dụng trong phản hồi',
        'Số dư: mức tối thiểu "một trăm" không phải số (vd 100000 hoặc {{vars.minBalance}})',
      ]),
    );
  });
});
