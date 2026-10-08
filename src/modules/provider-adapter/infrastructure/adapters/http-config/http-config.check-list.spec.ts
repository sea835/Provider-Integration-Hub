import {
  buildRequest,
  checkTarget,
  readCheck,
  requestScope,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.engine';
import { HttpConfigParams } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';
import {
  parseParams,
  readinessIssues,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';
import { HttpResult } from '@modules/provider-adapter/infrastructure/http/http-json.client';

const http = (status: number, body: unknown): HttpResult => ({
  ok: true,
  status,
  body,
  rawText: JSON.stringify(body),
  durationMs: 5,
});

const eligibleList = {
  code: 0,
  data: {
    phone: '0912345678',
    packages: [
      { code: 'SD70', name: 'Gói SD70 - 70k/tháng' },
      { code: 'MXH120', name: 'Gói MXH120' },
    ],
  },
};

function parse(check: Record<string, unknown>): HttpConfigParams {
  const { params, issues } = parseParams({
    spec: {
      check: {
        enabled: true,
        mode: 'LIST',
        request: {
          method: 'GET',
          path: '/subscribers/{{order.phone}}/eligible-packages',
        },
        matchField: 'data.packages[*].code',
        ...check,
      },
    },
  });
  expect(issues).toEqual([]);
  return params;
}

const order = (packageCode: string) => ({
  transCode: 'T1',
  action: 'BUY_DATA',
  packageCode,
  phone: '0912345678',
  serial: null,
  supplierTransId: null,
});

function check(params: HttpConfigParams, packageCode: string, res: HttpResult) {
  return readCheck(params.spec, res, checkTarget(params, order(packageCode)));
}

describe('Kiểm tra gói: dò trong danh sách gói đăng ký được', () => {
  const params = parse({});

  it('gọi API theo số điện thoại của đơn', () => {
    const built = buildRequest(
      params.spec,
      params.spec.check.request,
      'https://ncc.test',
      requestScope(params, {}, order('SD70')),
      'check',
    );
    expect(built.url).toBe(
      'https://ncc.test/subscribers/0912345678/eligible-packages',
    );
  });

  it('có mã gói trong danh sách → đăng ký được', () => {
    expect(check(params, 'MXH120', http(200, eligibleList))).toMatchObject({
      eligible: true,
      explain: 'Có "MXH120" trong danh sách 2 gói đăng ký được',
    });
  });

  it('không có trong danh sách → không đăng ký được, kèm lý do', () => {
    expect(check(params, 'BIG90', http(200, eligibleList))).toEqual({
      eligible: false,
      reason: {
        code: 'PACKAGE_NOT_ELIGIBLE',
        message: 'Gói BIG90 không có trong danh sách gói thuê bao đăng ký được',
      },
      explain: expect.stringContaining('không gửi đơn') as string,
    });
  });

  it('danh sách rỗng → không đăng ký được gói nào', () => {
    expect(
      check(params, 'SD70', http(200, { code: 0, data: { packages: [] } }))
        .eligible,
    ).toBe(false);
  });

  it('dò theo tên gói, không phân biệt hoa thường và khoảng trắng thừa', () => {
    const byName = parse({
      matchField: 'data.packages[*].name',
      ignoreCase: true,
    });
    expect(
      check(byName, '  gói mxh120 ', http(200, eligibleList)).eligible,
    ).toBe(true);
    const exact = parse({ matchField: 'data.packages[*].name' });
    expect(check(exact, 'gói mxh120', http(200, eligibleList)).eligible).toBe(
      false,
    );
  });

  it('giá trị đem dò lấy từ trường thêm của đơn', () => {
    const byExtra = parse({
      matchField: 'data.packages[*].name',
      matchValue: '{{order.extra.packageName}}',
    });
    const target = checkTarget(byExtra, {
      ...order('SD70'),
      extra: { packageName: 'Gói MXH120' },
    });
    expect(target).toBe('Gói MXH120');
    expect(
      readCheck(byExtra.spec, http(200, eligibleList), target).eligible,
    ).toBe(true);
  });

  it('không chắc thì không chặn đơn: lỗi HTTP, sai vị trí danh sách, giá trị rỗng', () => {
    expect(
      check(params, 'SD70', http(500, { message: 'lỗi hệ thống' })).eligible,
    ).toBeNull();
    expect(
      check(params, 'SD70', http(200, { code: 0, data: {} })).eligible,
    ).toBeNull();
    expect(
      readCheck(params.spec, http(200, eligibleList), '').eligible,
    ).toBeNull();
    expect(
      check(params, 'SD70', {
        ok: false,
        kind: 'TIMEOUT',
        message: 'Hết thời gian chờ',
        durationMs: 1000,
      }).eligible,
    ).toBeNull();
  });

  it('điều kiện thành công riêng: phản hồi báo lỗi thì chưa rõ', () => {
    const strict = parse({
      success: [{ path: 'body.code', operator: 'IN', values: ['0'] }],
    });
    expect(
      check(
        strict,
        'SD70',
        http(200, { code: 99, message: 'Thuê bao không tồn tại' }),
      ).explain,
    ).toContain('Thuê bao không tồn tại');
  });

  it('chế độ dò danh sách không đòi điều kiện được / không được', () => {
    expect(readinessIssues(params)).not.toContain(
      'Kiểm tra gói: chưa khai báo khi nào là đăng ký được / không được',
    );
  });

  it('chưa chọn trường so khớp → cảnh báo', () => {
    const { params: missing } = parseParams({
      spec: {
        check: { enabled: true, mode: 'LIST', request: { path: '/x' } },
      },
    });
    expect(readinessIssues(missing)).toContain(
      'Kiểm tra gói: chưa chọn trường chứa mã hoặc tên gói trong danh sách',
    );
  });
});
