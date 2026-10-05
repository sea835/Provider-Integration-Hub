import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import { HubStandardAdapter } from '@modules/provider-adapter/infrastructure/adapters/hub-standard/hub-standard.adapter';
import { HttpConfigAdapter } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.adapter';
import { HttpJsonClient } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { TokenManager } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.token-manager';
import {
  MemoryTokenStore,
  PlainCipher,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.test-support';
import { UnknownAdapterTypeError } from '@modules/provider-adapter/domain/adapter.errors';

describe('AdapterRegistry', () => {
  const http = new HttpJsonClient();
  const registry = new AdapterRegistry([
    new HubStandardAdapter(http),
    new HttpConfigAdapter(
      http,
      new TokenManager(http, new MemoryTokenStore(), new PlainCipher()),
    ),
  ]);

  describe('validateConfig', () => {
    it('HUB_STANDARD: cần keyId và secret, callbackSecret tuỳ chọn', async () => {
      await expect(
        registry.validateConfig(
          'HUB_STANDARD',
          { keyId: 'hub' },
          { secret: 's' },
        ),
      ).resolves.toEqual([]);
      const missingKeyId = await registry.validateConfig(
        'HUB_STANDARD',
        {},
        { secret: 's' },
      );
      expect(missingKeyId.length).toBeGreaterThan(0);
      expect(missingKeyId.every((m) => m.startsWith('params.keyId'))).toBe(
        true,
      );
      const missingSecret = await registry.validateConfig(
        'HUB_STANDARD',
        { keyId: 'hub' },
        { callbackSecret: 'c' },
      );
      expect(missingSecret.length).toBeGreaterThan(0);
      expect(missingSecret.every((m) => m.startsWith('secrets.secret'))).toBe(
        true,
      );
    });

    it('HTTP_CONFIG: dùng kiểm tra riêng của adapter, nhận tên bí mật tự đặt', async () => {
      await expect(
        registry.validateConfig(
          'HTTP_CONFIG',
          { secretKeys: ['token'] },
          { token: 'abc' },
        ),
      ).resolves.toEqual([]);
      expect(
        await registry.validateConfig(
          'HTTP_CONFIG',
          { spec: { auth: { type: 'OAUTH' } } },
          null,
        ),
      ).toEqual([expect.stringContaining('spec.auth.type')]);
    });

    it('secrets = null thì chỉ validate params (cập nhật không đổi secret)', async () => {
      await expect(
        registry.validateConfig('HUB_STANDARD', { keyId: 'hub' }, null),
      ).resolves.toEqual([]);
    });

    it('adapter không tồn tại thì báo lỗi', async () => {
      await expect(
        registry.validateConfig('ANISIM', {}, null),
      ).rejects.toBeInstanceOf(UnknownAdapterTypeError);
    });
  });

  it('describe: Tự cấu hình dùng trình soạn tích hợp và có bản tích hợp mặc định', () => {
    const config = registry
      .describe()
      .find((item) => item.type === 'HTTP_CONFIG');
    expect(config).toMatchObject({ editor: 'HTTP_CONFIG', callback: true });
    expect(config?.defaultParams).toMatchObject({ vars: {}, secretKeys: [] });
    expect(config?.defaultParams?.spec).toBeDefined();
    const standard = registry
      .describe()
      .find((item) => item.type === 'HUB_STANDARD');
    expect(standard).toMatchObject({ editor: 'FIELDS', label: 'Chuẩn Hub v1' });
    expect(standard?.secrets.map((field) => field.key)).toEqual([
      'secret',
      'callbackSecret',
    ]);
  });
});
