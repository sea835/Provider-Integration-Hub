import { Injectable, Optional } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
} from '@casl/ability';
import { Action } from '../domain/action.enum';
import { AppAbility, Subjects } from '../domain/policy.types';
import { Role } from '@modules/user/domain/user-role';
import { UserEntity } from '@modules/user/domain/user.entity';
import { TokenPayload } from '@modules/authentication/domain/auth-token.vo';
import { RoleRepositoryPort } from '../domain/role.repository.port';
import { PermissionEntity } from '../domain/permission.entity';

@Injectable()
export class CaslAbilityFactory {
  constructor(
    @Optional() private readonly roleRepository?: RoleRepositoryPort,
  ) {}

  async createForUser(user?: TokenPayload): Promise<AppAbility> {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user?.role === Role.ADMIN) {
      can(Action.Manage, 'all');
      return build({
        detectSubjectType: (item) =>
          item.constructor as ExtractSubjectType<Subjects>,
      });
    }

    let dynamicPermissions: PermissionEntity[] = [];
    if (user?.role && this.roleRepository) {
      try {
        dynamicPermissions = await this.roleRepository.getPermissionsByRoleCode(
          user.role,
        );
      } catch {
        dynamicPermissions = [];
      }
    }

    if (dynamicPermissions.length > 0) {
      for (const perm of dynamicPermissions) {
        const action = perm.action as Action;
        let subject: any = perm.subject;
        if (subject === 'User' || subject === 'UserEntity') {
          subject = UserEntity;
        }

        const conditions = perm.conditions
          ? this.interpolateConditions(perm.conditions, user)
          : undefined;

        if (conditions) {
          can(action, subject, conditions as never);
        } else {
          can(action, subject);
        }
      }
    } else {
      if (user?.role === Role.MANAGER) {
        can(Action.Read, UserEntity);
        can(Action.Update, UserEntity);
        cannot(Action.Delete, UserEntity);
      } else if (user?.role === Role.USER) {
        can(Action.Read, UserEntity);
        can(Action.Update, UserEntity, { id: user.sub } as never);
        cannot(Action.Delete, UserEntity);
      }
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }

  private interpolateConditions(
    conditions: Record<string, unknown>,
    user?: TokenPayload,
  ): Record<string, unknown> {
    const parsed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(conditions)) {
      if (typeof value === 'string' && value === '${user.sub}') {
        parsed[key] = user?.sub;
      } else {
        parsed[key] = value;
      }
    }
    return parsed;
  }
}
