import { ConflictException, NotFoundException } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleRepositoryPort } from '../domain/role.repository.port';
import { PermissionRepositoryPort } from '../domain/permission.repository.port';

describe('RoleService', () => {
  let roleService: RoleService;
  let mockRoleRepo: Record<string, jest.Mock>;
  let mockPermissionRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRoleRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getPermissionsByRoleId: jest.fn(),
      getPermissionsByRoleCode: jest.fn(),
      assignPermissionsToRole: jest.fn(),
    };
    mockPermissionRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByActionAndSubject: jest.fn(),
      delete: jest.fn(),
    };
    roleService = new RoleService(
      mockRoleRepo as unknown as RoleRepositoryPort,
      mockPermissionRepo as unknown as PermissionRepositoryPort,
    );
  });

  it('nên tạo vai trò mới thành công khi mã chưa tồn tại', async () => {
    mockRoleRepo.findByCode.mockResolvedValue(null);
    mockRoleRepo.create.mockResolvedValue({
      id: 'r-1',
      code: 'SUPPORT',
      name: 'Chuyên viên Hỗ trợ',
      status: 'ACTIVE',
    });

    const result = await roleService.createRole({
      code: 'support',
      name: 'Chuyên viên Hỗ trợ',
    });

    expect(result.code).toBe('SUPPORT');
    expect(mockRoleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SUPPORT' }),
    );
  });

  it('nên ném ConflictException khi mã vai trò đã tồn tại', async () => {
    mockRoleRepo.findByCode.mockResolvedValue({
      id: 'r-1',
      code: 'SUPPORT',
    });

    await expect(
      roleService.createRole({ code: 'SUPPORT', name: 'Hỗ trợ' }),
    ).rejects.toThrow(ConflictException);
  });

  it('nên ném NotFoundException khi tìm vai trò không tồn tại', async () => {
    mockRoleRepo.findById.mockResolvedValue(null);

    await expect(roleService.findRoleById('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('nên gán permissions vào role thành công', async () => {
    mockRoleRepo.findById.mockResolvedValue({ id: 'r-1', code: 'SUPPORT' });
    mockRoleRepo.assignPermissionsToRole.mockResolvedValue(undefined);

    const result = await roleService.assignPermissions('r-1', ['p-1', 'p-2']);
    expect(result).toEqual({ success: true });
    expect(mockRoleRepo.assignPermissionsToRole).toHaveBeenCalledWith('r-1', [
      'p-1',
      'p-2',
    ]);
  });
});
