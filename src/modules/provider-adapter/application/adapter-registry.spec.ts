import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import { AnisimAdapter } from '@modules/provider-adapter/infrastructure/adapters/anisim/anisim.adapter';
import { HttpJsonClient } from '@modules/provider-adapter/infrastructure/http/http-json.client';
import { UnknownAdapterTypeError } from '@modules/provider-adapter/domain/adapter.errors';

describe('AdapterRegistry.validateConfig', () => {
  const registry = new AdapterRegistry([
    new AnisimAdapter(new HttpJsonClient()),
  ]);

  it('ANISIM: params rỗng hợp lệ (class không có decorator)', async () => {
    await expect(
      registry.validateConfig('ANISIM', {}, { apiKey: 'k' }),
    ).resolves.toEqual([]);
  });

  it('ANISIM: thiếu apiKey hoặc có key lạ thì báo lỗi', async () => {
    expect(await registry.validateConfig('ANISIM', {}, {})).not.toHaveLength(0);
    expect(
      await registry.validateConfig('ANISIM', { foo: 1 }, { apiKey: 'k' }),
    ).not.toHaveLength(0);
  });

  it('secrets = null thì chỉ validate params (cập nhật không đổi secret)', async () => {
    await expect(registry.validateConfig('ANISIM', {}, null)).resolves.toEqual(
      [],
    );
  });

  it('adapter không tồn tại thì báo lỗi', async () => {
    await expect(
      registry.validateConfig('NOPE', {}, null),
    ).rejects.toBeInstanceOf(UnknownAdapterTypeError);
  });
});
