import { ConflictException, NotFoundException } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionRepositoryPort } from '../domain/permission.repository.port';

describe('PermissionService', () => {
  let permissionService: PermissionService;
  let mockPermissionRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    mockPermissionRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByActionAndSubject: jest.fn(),
      delete: jest.fn(),
    };
    permissionService = new PermissionService(
      mockPermissionRepo as unknown as PermissionRepositoryPort,
    );
  });

  it('nên tạo quyền mới thành công', async () => {
    mockPermissionRepo.findByActionAndSubject.mockResolvedValue(null);
    mockPermissionRepo.create.mockResolvedValue({
      id: 'p-1',
      action: 'read',
      subject: 'Provider',
      status: 'ACTIVE',
    });

    const result = await permissionService.createPermission({
      action: 'read',
      subject: 'Provider',
    });

    expect(result.action).toBe('read');
    expect(result.subject).toBe('Provider');
  });

  it('nên ném ConflictException khi quyền đã tồn tại', async () => {
    mockPermissionRepo.findByActionAndSubject.mockResolvedValue({
      id: 'p-1',
      action: 'read',
      subject: 'Provider',
    });

    await expect(
      permissionService.createPermission({
        action: 'read',
        subject: 'Provider',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('nên ném NotFoundException khi không tìm thấy quyền', async () => {
    mockPermissionRepo.findById.mockResolvedValue(null);

    await expect(
      permissionService.findPermissionById('non-existent-id'),
    ).rejects.toThrow(NotFoundException);
  });
});
