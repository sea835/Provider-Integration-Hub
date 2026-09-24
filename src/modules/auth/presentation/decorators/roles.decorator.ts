import { SetMetadata } from '@nestjs/common';
import type { RoleType } from '@modules/user/domain/user-role';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
