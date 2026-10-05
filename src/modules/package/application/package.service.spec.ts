import { LoggerPort } from '@common/logger';
import { AdapterRegistry } from '@modules/provider-adapter/application/adapter-registry';
import { SupplierConfigService } from '@modules/supplier/application/supplier-config.service';
import { PackageService } from '@modules/package/application/package.service';
import {
  FeatureNotSupportedError,
  PackageSupplierUnavailableError,
  SupplierCallFailedError,
} from '@modules/package/domain/package.errors';

describe('PackageService', () => {
  let supplier: Record<string, unknown>;
  let adapter: Record<string, jest.Mock>;
  let service: PackageService;

  beforeEach(() => {
    supplier = {
      id: 's1',
      code: 'NCC',
      version: 3,
      status: 'ACTIVE',
      adapterType: 'HTTP_CONFIG',
    };
    adapter = {
      features: jest.fn(() => ({
        packages: true,
        check: true,
        checkBeforeSubmit: false,
        orderList: false,
      })),
      listPackages: jest.fn(() =>
        Promise.resolve({
          ok: true,
          packages: [
            { code: 'P1', name: 'Gói 1', price: 1000, description: null },
          ],
          trace: { durationMs: 1 },
        }),
      ),
      checkPackage: jest.fn(() =>
        Promise.resolve({
          eligible: false,
          reason: { code: 'X', message: 'Không được' },
          trace: { durationMs: 1 },
        }),
      ),
    };
    const configs = {
      getByCode: jest.fn(() => Promise.resolve(supplier)),
      toContext: jest.fn(() => ({ supplierCode: 'NCC' })),
    };
    const logger = {
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    service = new PackageService(
      configs as unknown as SupplierConfigService,
      { get: () => adapter } as unknown as AdapterRegistry,
      logger as unknown as LoggerPort,
    );
  });

  it('danh sách gói: chuẩn hoá SĐT, nhớ 60 giây theo bộ lọc', async () => {
    const first = await service.listPackages({
      supplierCode: 'ncc',
      action: 'BUY_DATA',
      phone: '84912345678',
    });
    await service.listPackages({
      supplierCode: 'NCC',
      action: 'BUY_DATA',
      phone: '0912345678',
    });
    expect(first.packages).toHaveLength(1);
    expect(adapter.listPackages).toHaveBeenCalledTimes(1);
    expect(adapter.listPackages).toHaveBeenCalledWith(
      { supplierCode: 'NCC' },
      { action: 'BUY_DATA', phone: '0912345678', serial: null },
    );
    await service.listPackages({ supplierCode: 'NCC' });
    expect(adapter.listPackages).toHaveBeenCalledTimes(2);
  });

  it('NCC không có API / NCC lỗi / NCC tạm dừng → lỗi rõ ràng', async () => {
    adapter.listPackages.mockResolvedValueOnce({
      ok: false,
      message: 'x',
      unsupported: true,
      trace: { durationMs: 1 },
    });
    await expect(
      service.listPackages({ supplierCode: 'NCC', phone: '0911111111' }),
    ).rejects.toBeInstanceOf(FeatureNotSupportedError);

    adapter.listPackages.mockResolvedValueOnce({
      ok: false,
      message: 'HTTP 500',
      trace: { durationMs: 1 },
    });
    await expect(
      service.listPackages({ supplierCode: 'NCC', phone: '0922222222' }),
    ).rejects.toBeInstanceOf(SupplierCallFailedError);

    supplier.status = 'PAUSED';
    await expect(
      service.listPackages({ supplierCode: 'NCC' }),
    ).rejects.toBeInstanceOf(PackageSupplierUnavailableError);
  });

  it('kiểm tra gói: trả kết luận của NCC; thao tác mua data bắt buộc SĐT', async () => {
    await expect(
      service.checkPackage({
        supplierCode: 'NCC',
        action: 'BUY_DATA',
        packageCode: ' P1 ',
        phone: '0912345678',
      }),
    ).resolves.toEqual({
      supplierCode: 'NCC',
      packageCode: 'P1',
      eligible: false,
      reason: { code: 'X', message: 'Không được' },
    });
    await expect(
      service.checkPackage({
        supplierCode: 'NCC',
        action: 'BUY_DATA',
        packageCode: 'P1',
      }),
    ).rejects.toThrow('bắt buộc có số điện thoại');
  });

  it('NCC chưa khai báo API kiểm tra → không hỗ trợ, không gọi NCC', async () => {
    adapter.features.mockReturnValue({
      packages: false,
      check: false,
      checkBeforeSubmit: false,
      orderList: false,
    });
    await expect(
      service.checkPackage({
        supplierCode: 'NCC',
        action: 'ACTIVATE_SIM',
        packageCode: 'P1',
      }),
    ).rejects.toBeInstanceOf(FeatureNotSupportedError);
    expect(adapter.checkPackage).not.toHaveBeenCalled();
  });
});
