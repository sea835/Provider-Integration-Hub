import { InferSubjects, MongoAbility } from '@casl/ability';
import { BaseEntity } from '@common/base/base.entity';
import { Action } from './action.enum';

export type AnyEntityClass = new (...args: any[]) => any;
export type Subjects =
  | InferSubjects<typeof BaseEntity, true>
  | AnyEntityClass
  | string
  | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

export interface IPolicyHandler {
  handle(ability: AppAbility): boolean;
}

export type PolicyHandlerCallback = (ability: AppAbility) => boolean;

export type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;
