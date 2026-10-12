import { defaultProviderConfig } from '@modules/provider/domain/provider-config';
import {
  normalizeProviderConfig,
  parseProviderConfig,
  parseProviderSamples,
  readinessIssues,
} from '@modules/provider/domain/provider-config.validation';

describe('parseProviderConfig', () => {
  it('điền mặc định cho phần thiếu và bỏ dấu / cuối Base URL', () => {
    const { config, issues } = parseProviderConfig({
      baseUrl: 'https://api.partner.test/',
      spec: {
        balance: {
          request: { method: 'POST', path: '/balance' },
          balancePath: 'body.data.balance',
        },
      },
    });
    expect(issues).toEqual([]);
    expect(config.baseUrl).toBe('https://api.partner.test');
    expect(config.spec.balance.request.bodyType).toBe('JSON');
    expect(config.spec.balance.success).toEqual([
      { path: 'http.status', operator: 'IN', values: ['2xx'] },
    ]);
    expect(config.spec.token.enabled).toBe(false);
    expect(config.spec.auth.type).toBe('NONE');
  });

  it('gom lỗi kiểu dữ liệu thay vì ném lỗi', () => {
    const { issues } = parseProviderConfig({
      baseUrl: 'ftp://partner.test',
      vars: { '1bad': 'x' },
      spec: {
        auth: { type: 'OAUTH' },
        headers: [{ value: 'no-name' }],
        balance: {
          request: { method: 'DELETE' },
          success: [{ path: 'body.code', operator: 'IN', values: [] }],
        },
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        'baseUrl phải là địa chỉ http:// hoặc https:// hợp lệ',
        'vars.1bad: tên biến chỉ gồm chữ, số, gạch dưới và bắt đầu bằng chữ',
        'spec.auth.type phải là một trong: NONE, HEADER, BEARER, BASIC, QUERY',
        'spec.headers[0].name không được để trống',
        'spec.balance.request.method phải là một trong: GET, POST, PUT',
        'spec.balance.success[0].values cần ít nhất một giá trị',
      ]),
    );
  });
});

describe('readinessIssues', () => {
  it('cấu hình mặc định còn thiếu Base URL và đường dẫn số dư', () => {
    expect(readinessIssues(defaultProviderConfig(), [])).toEqual([
      'Chưa nhập Base URL mặc định (cần cho API số dư)',
      'Chưa nhập đường dẫn tới số dư trong phản hồi',
    ]);
  });

  it('báo thiếu bí mật, biến, và các phần bắt buộc khi bật token / chữ ký', () => {
    const { config } = parseProviderConfig({
      baseUrl: 'https://api.partner.test',
      vars: { partnerCode: 'PQ01' },
      spec: {
        auth: { type: 'BEARER', value: '{{token}}' },
        token: {
          enabled: true,
          request: {
            method: 'POST',
            body: [{ key: 'password', value: '{{secrets.password}}' }],
          },
        },
        signature: {
          enabled: true,
          algorithm: 'HMAC_SHA256',
          input: 'TEMPLATE',
          apply: { balance: true },
        },
        headers: [{ name: 'X-Channel', value: '{{vars.channel}}' }],
        balance: {
          request: { method: 'GET', path: '/balance' },
          balancePath: 'body.balance',
        },
      },
    });
    expect(readinessIssues(config, ['other'])).toEqual([
      'Chưa nhập đường dẫn API đăng nhập',
      'Chưa nhập đường dẫn tới token trong phản hồi đăng nhập',
      'Chữ ký HMAC cần khoá ký',
      'Chưa nhập mẫu chuỗi đem ký',
      'Chưa nhập bí mật "password"',
      'Chưa khai báo biến "channel"',
    ]);
  });

  it('đủ cấu hình thì rỗng', () => {
    const { config } = parseProviderConfig({
      baseUrl: 'https://api.partner.test',
      spec: {
        auth: {
          type: 'HEADER',
          name: 'X-Api-Key',
          value: '{{secrets.apiKey}}',
        },
        balance: {
          request: { method: 'GET', path: '/balance' },
          balancePath: 'body.balance',
        },
      },
    });
    expect(readinessIssues(config, ['apiKey'])).toEqual([]);
  });
});

describe('readinessIssues khi gọi thử', () => {
  const { config } = parseProviderConfig({
    baseUrl: 'https://api.partner.test',
    spec: {
      token: { enabled: true, request: { method: 'POST', path: '/login' } },
      balance: { request: { method: 'GET', path: '/balance' } },
    },
  });

  it('gọi thử đăng nhập không cần biết token và số dư nằm ở đâu', () => {
    expect(readinessIssues(config, [], 'TRY_LOGIN')).toEqual([]);
  });

  it('gọi thử số dư cần đường dẫn token (để có token mà gọi) nhưng chưa cần đường dẫn số dư', () => {
    expect(readinessIssues(config, [], 'TRY_BALANCE')).toEqual([
      'Chưa nhập đường dẫn tới token trong phản hồi đăng nhập',
    ]);
    expect(readinessIssues(config, [], 'SCAN')).toEqual([
      'Chưa nhập đường dẫn tới số dư trong phản hồi',
      'Chưa nhập đường dẫn tới token trong phản hồi đăng nhập',
    ]);
  });

  it('gọi thử đăng nhập khi chưa bật token thì báo rõ', () => {
    const plain = parseProviderConfig({
      baseUrl: 'https://api.partner.test',
    }).config;
    expect(readinessIssues(plain, [], 'TRY_LOGIN')).toEqual([
      'Chưa bật Đăng nhập lấy token',
    ]);
  });
});

describe('parseProviderSamples', () => {
  const saved = {
    login: {
      httpStatus: 200,
      body: { data: { accessToken: '***' } },
      capturedAt: '2026-10-12T02:00:00.000Z',
    },
  };

  it('lưu mẫu mới, giữ mẫu của lời gọi không gửi lên', () => {
    const { samples, issues } = parseProviderSamples(
      {
        balance: {
          httpStatus: 200,
          body: { data: { availBalance: 120000 } },
          capturedAt: '2026-10-12T03:00:00.000Z',
        },
      },
      saved,
    );
    expect(issues).toEqual([]);
    expect(samples.login).toEqual(saved.login);
    expect(samples.balance).toEqual({
      httpStatus: 200,
      body: { data: { availBalance: 120000 } },
      capturedAt: '2026-10-12T03:00:00.000Z',
    });
  });

  it('lời gọi có giá trị undefined (DTO không gửi) thì không đụng tới', () => {
    const { samples } = parseProviderSamples(
      { login: undefined, balance: undefined },
      saved,
    );
    expect(samples).toEqual(saved);
  });

  it('null xoá mẫu; thiếu thời điểm thì lấy thời điểm hiện tại', () => {
    const { samples } = parseProviderSamples(
      { login: null, balance: { httpStatus: 503, body: 'down' } },
      saved,
    );
    expect(samples.login).toBeUndefined();
    expect(samples.balance?.httpStatus).toBe(503);
    expect(Number.isNaN(Date.parse(samples.balance?.capturedAt ?? ''))).toBe(
      false,
    );
  });

  it('từ chối mẫu quá lớn hoặc HTTP status sai', () => {
    const { issues } = parseProviderSamples(
      {
        login: { httpStatus: 999, body: {} },
        balance: { httpStatus: 200, body: 'x'.repeat(100_001) },
      },
      null,
    );
    expect(issues).toEqual([
      'samples.login.httpStatus phải là số nguyên từ 100 đến 599',
      'samples.balance.body quá lớn (tối đa 100000 ký tự JSON)',
    ]);
  });
});

describe('nhiều Base URL', () => {
  const raw = {
    baseUrl: 'https://api.partner.test',
    hosts: [
      {
        key: 'auth',
        label: 'Máy chủ đăng nhập',
        url: 'https://id.partner.test/',
      },
    ],
    spec: {
      token: {
        enabled: true,
        request: { host: 'auth', method: 'POST', path: '/login' },
        tokenPath: 'body.token',
      },
      balance: {
        request: { method: 'GET', path: '/balance' },
        balancePath: 'body.balance',
      },
    },
  };

  it('đọc danh sách địa chỉ có tên và request chọn theo key', () => {
    const { config, issues } = parseProviderConfig(raw);
    expect(issues).toEqual([]);
    expect(config.hosts).toEqual([
      {
        key: 'auth',
        label: 'Máy chủ đăng nhập',
        url: 'https://id.partner.test',
      },
    ]);
    expect(config.spec.token.request.host).toBe('auth');
    expect(config.spec.balance.request.host).toBe('');
    expect(readinessIssues(config, [])).toEqual([]);
  });

  it('báo lỗi tên sai, URL sai, trùng tên', () => {
    const { issues } = parseProviderConfig({
      hosts: [
        { key: '1auth', url: 'https://a.test' },
        { key: 'pay', url: 'ftp://b.test' },
        { key: 'pay', url: 'https://c.test' },
      ],
    });
    expect(issues).toEqual([
      'hosts[0].key phải bắt đầu bằng chữ, chỉ gồm chữ, số, gạch dưới (tối đa 30 ký tự)',
      'hosts[1].url phải là địa chỉ http:// hoặc https:// hợp lệ',
      'hosts: trùng tên pay',
    ]);
  });

  it('request trỏ tới địa chỉ đã xoá hoặc chưa có URL thì chưa sẵn sàng', () => {
    const removed = parseProviderConfig({ ...raw, hosts: [] }).config;
    expect(readinessIssues(removed, [])).toEqual([
      'API đăng nhập đang gọi tới Base URL "auth" nhưng địa chỉ này không còn trong danh sách',
    ]);
    const empty = parseProviderConfig({
      ...raw,
      hosts: [{ key: 'auth', url: '' }],
    }).config;
    expect(readinessIssues(empty, [])).toEqual([
      'Base URL "auth" chưa nhập địa chỉ',
    ]);
  });

  it('mọi request dùng địa chỉ có tên thì không cần Base URL mặc định', () => {
    const { config } = parseProviderConfig({
      hosts: [{ key: 'main', url: 'https://api.partner.test' }],
      spec: {
        balance: {
          request: { host: 'main', method: 'GET', path: '/balance' },
          balancePath: 'body.balance',
        },
      },
    });
    expect(readinessIssues(config, [])).toEqual([]);
  });

  it('cấu hình cũ chưa có hosts được chuẩn hoá khi đọc', () => {
    const legacy = normalizeProviderConfig({
      baseUrl: 'https://api.partner.test',
      spec: { balance: { request: { method: 'GET', path: '/balance' } } },
    });
    expect(legacy.hosts).toEqual([]);
    expect(legacy.spec.balance.request.host).toBe('');
    expect(legacy.spec.token.request.host).toBe('');
  });
});
