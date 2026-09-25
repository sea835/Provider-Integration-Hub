import { Module } from '@nestjs/common';
import { CaslAbilityFactory } from './application/casl-ability.factory';
import { PoliciesGuard } from './presentation/guards/policies.guard';
import { RoleService } from './application/role.service';
import { PermissionService } from './application/permission.service';
import { RoleRepositoryPort } from './domain/role.repository.port';
import { PermissionRepositoryPort } from './domain/permission.repository.port';
import { RoleRepository } from './infrastructure/role.repository';
import { PermissionRepository } from './infrastructure/permission.repository';
import { RoleController } from './presentation/role.controller';
import { PermissionController } from './presentation/permission.controller';
import { AbilityController } from './presentation/ability.controller';

@Module({
  controllers: [RoleController, PermissionController, AbilityController],
  providers: [
    CaslAbilityFactory,
    PoliciesGuard,
    RoleService,
    PermissionService,
    {
      provide: RoleRepositoryPort,
      useClass: RoleRepository,
    },
    {
      provide: PermissionRepositoryPort,
      useClass: PermissionRepository,
    },
  ],
  exports: [
    CaslAbilityFactory,
    PoliciesGuard,
    RoleService,
    PermissionService,
    RoleRepositoryPort,
    PermissionRepositoryPort,
  ],
})
export class AuthorizationModule {}
