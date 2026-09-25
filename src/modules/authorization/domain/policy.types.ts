import { InferSubjects, MongoAbility } from '@casl/ability';
import { UserEntity } from '@modules/user/domain/user.entity';
import { Action } from './action.enum';

export type Subjects = InferSubjects<typeof UserEntity> | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

export interface IPolicyHandler {
  handle(ability: AppAbility): boolean;
}

export type PolicyHandlerCallback = (ability: AppAbility) => boolean;

export type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;
