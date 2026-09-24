import { Controller } from '@nestjs/common';
import { BaseController } from '@common/base/base.controller';
import {UserEntity} from "@modules/user/domain/user.entity";
import { UserService } from "@modules/user/application/user.service";


@Controller('users')
export class UserController extends BaseController<UserEntity> {
    constructor(private readonly userService: UserService) {
        super(userService);
    }
}
