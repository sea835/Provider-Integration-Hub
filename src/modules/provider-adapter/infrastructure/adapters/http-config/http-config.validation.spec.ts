import {
  parseParams,
  readinessIssues,
  validateSecrets,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.validation';

describe('Kiểm tra bản tích hợp Tự cấu hình', () => {
  it('params rỗng được điền mặc định, hợp lệ nhưng chưa đủ để chạy', () => {
    const { params, issues } = parseParams({});
    expect(issues).toEqual([]);
    expect(params.spec.submit.request.method).toBe('POST');
    expect(readinessIssues(params)).toEqual(
      expect.arrayContaining([
        'Chưa nhập đường dẫn gửi đơn',
        'Chưa nhập đường dẫn tra cứu đơn',
      ]),
    );
  });

  it('báo lỗi cấu trúc rõ vị trí', () => {
    const { issues } = parseParams({
      vars: { 'sai tên': 'x' },
      spec: {
        submit: {
          request: { method: 'DELETE' },
          success: [{ path: 'http.status', operator: 'LIKE', values: ['2xx'] }],
        },
        order: { statusMap: [{ value: '1', outcome: 'DONE' }] },
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('vars'),
        expect.stringContaining('spec.submit.request.method'),
        expect.stringContaining('spec.submit.success[0].operator'),
        expect.stringContaining('spec.order.statusMap[0].outcome'),
      ]),
    );
  });

  it('cảnh báo khi dùng biến hoặc bí mật chưa khai báo', () => {
    const { params } = parseParams({
      spec: {
        auth: { type: 'BEARER', value: '{{secrets.token}}' },
        headers: [{ name: 'X-Partner', value: '{{vars.partner}}' }],
      },
    });
    expect(readinessIssues(params)).toEqual(
      expect.arrayContaining([
        'Đang dùng bí mật token nhưng chưa khai báo',
        'Đang dùng biến partner nhưng chưa khai báo',
      ]),
    );
  });

  it('bí mật phải khớp danh sách secretKeys và là chuỗi khác rỗng', () => {
    expect(validateSecrets({ token: 'abc' }, ['token'])).toEqual([]);
    expect(validateSecrets({ token: '' }, ['token'])).toHaveLength(1);
    expect(validateSecrets({ token: 'abc' }, ['token', 'other'])).toHaveLength(
      1,
    );
  });

  it('đăng nhập lấy token và chữ ký: báo thiếu phần bắt buộc', () => {
    const { params, issues } = parseParams({
      spec: {
        token: { enabled: true, ttlSec: 10 },
        signature: { enabled: true, algorithm: 'HMAC_SHA256', name: '' },
      },
    });
    expect(issues).toEqual([expect.stringContaining('spec.token.ttlSec')]);
    expect(readinessIssues(params)).toEqual(
      expect.arrayContaining([
        'Đăng nhập lấy token: chưa nhập đường dẫn đăng nhập',
        'Đăng nhập lấy token: chưa chọn vị trí token trong phản hồi',
        'Chữ ký: chưa nhập khoá ký (vd {{secrets.secretKey}})',
      ]),
    );
  });

  it('dùng {{token}} mà chưa bật đăng nhập thì cảnh báo; thuật toán lạ bị từ chối', () => {
    const { params, issues } = parseParams({
      spec: {
        auth: { type: 'BEARER', value: '{{token}}' },
        signature: { algorithm: 'RSA' },
      },
    });
    expect(issues).toEqual([
      expect.stringContaining('spec.signature.algorithm'),
    ]);
    expect(readinessIssues(params)).toContain(
      'Đang dùng {{token}} nhưng chưa bật Đăng nhập lấy token',
    );
  });

  it('bí mật dùng trong khoá ký hoặc request đăng nhập phải được khai báo', () => {
    const { params } = parseParams({
      spec: {
        token: {
          enabled: true,
          request: {
            method: 'POST',
            path: '/login',
            body: [{ key: 'password', value: '{{secrets.password}}' }],
          },
          tokenPath: 'token',
        },
        signature: { enabled: true, key: '{{secrets.signKey}}' },
      },
    });
    expect(readinessIssues(params)).toEqual(
      expect.arrayContaining([
        'Đang dùng bí mật password nhưng chưa khai báo',
        'Đang dùng bí mật signKey nhưng chưa khai báo',
      ]),
    );
  });

  it('ô đường dẫn bị điền giá trị, hoặc trỏ cố định vào phần tử [0] của danh sách: cảnh báo kèm cách sửa', () => {
    const { params } = parseParams({
      spec: {
        query: { source: 'ORDERS' },
        orders: {
          enabled: true,
          request: { method: 'GET', path: '/orders' },
          listPath: 'data.items',
          matchField: 'requestId',
        },
        order: {
          status: 'data.items[0].status',
          errorCode: '4001',
          errorMessage: 'Invalid parameter. Serial is not available',
          supplierTransId: 'id',
          delivery: { msisdn: 'phoneNumber || phone', lpa: 'esims[0].lpa' },
          statusMap: [
            { value: '4', outcome: 'SUCCESS' },
            {
              value: '5',
              outcome: 'FAILED',
              errorCode: 'SIM is not in stock or unavailable',
            },
            { value: '6', outcome: 'FAILED', errorCode: 'ANI_ORDER_CANCELLED' },
          ],
        },
      },
    });
    const issues = readinessIssues(params);
    expect(issues).toEqual(
      expect.arrayContaining([
        'Trạng thái đơn: ô Trường trạng thái trỏ cố định vào một phần tử (data.items[0].status), dùng [*] để đọc mọi phần tử: data.items[*].status',
        'Trạng thái đơn: ô Mã lỗi của đơn đang là một giá trị ("4001"), cần đường dẫn tới trường',
        'Trạng thái đơn: ô Thông báo lỗi của đơn đang là một giá trị ("Invalid parameter. Serial is not availab…"), cần đường dẫn tới trường',
        'Trạng thái đơn: mã lỗi riêng của giá trị "5" có khoảng trắng, mã lỗi phải viết liền (vd ANI_SIM_UNAVAILABLE)',
      ]),
    );
    expect(
      issues.filter((issue) => issue.startsWith('Trạng thái đơn')),
    ).toHaveLength(4);
  });

  it('luật trường theo thao tác: thiếu thì lấy mặc định của Hub, giá trị lạ bị báo', () => {
    const { params, issues } = parseParams({
      spec: {
        fields: { BUY_DATA: { phone: 'OPTIONAL' }, TOPUP: { serial: 'MAYBE' } },
      },
    });
    expect(params.spec.fields.BUY_DATA).toEqual({
      phone: 'OPTIONAL',
      serial: 'OPTIONAL',
    });
    expect(params.spec.fields.ACTIVATE_SIM).toEqual({
      phone: 'OPTIONAL',
      serial: 'OPTIONAL',
    });
    expect(issues).toEqual([
      expect.stringContaining('spec.fields.TOPUP.serial'),
    ]);
  });
});
