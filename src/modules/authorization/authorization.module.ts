import { Module } from '@nestjs/common';
import { CaslAbilityFactory } from './application/casl-ability.factory';
import { PoliciesGuard } from './presentation/guards/policies.guard';

@Module({
  providers: [CaslAbilityFactory, PoliciesGuard],
  exports: [CaslAbilityFactory, PoliciesGuard],
})
export class AuthorizationModule {}
