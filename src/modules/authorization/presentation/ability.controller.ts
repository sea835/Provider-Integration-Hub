import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { packRules } from '@casl/ability/extra';
import { CurrentUser } from '@modules/authentication/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '@modules/authentication/domain/auth-token.vo';
import { CaslAbilityFactory } from '../application/casl-ability.factory';

@ApiTags('authorization')
@ApiBearerAuth()
@Controller('authorization')
export class AbilityController {
  constructor(private readonly abilityFactory: CaslAbilityFactory) {}

  @Get('me/abilities')
  @ApiOperation({
    summary: 'Lấy danh sách rules phân quyền của người dùng hiện tại cho Frontend',
  })
  async getMyAbilities(@CurrentUser() user: TokenPayload) {
    const ability = await this.abilityFactory.createForUser(user);
    return {
      rules: packRules(ability.rules),
    };
  }
}
