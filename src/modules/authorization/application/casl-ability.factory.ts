import { Injectable } from '@nestjs/common';
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

@Injectable()
export class CaslAbilityFactory {
  createForUser(user?: TokenPayload): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user?.role === Role.ADMIN) {
      can(Action.Manage, 'all');
    } else if (user?.role === Role.MANAGER) {
      can(Action.Read, UserEntity);
      can(Action.Update, UserEntity);
      cannot(Action.Delete, UserEntity);
    } else if (user?.role === Role.USER) {
      can(Action.Read, UserEntity);
      can(Action.Update, UserEntity, { id: user.sub } as never);
      cannot(Action.Delete, UserEntity);
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
