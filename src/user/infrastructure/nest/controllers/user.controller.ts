import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { SkipEmailVerification } from '../../../../shared/nest/decorators/skip-email-verification.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { GetUserProfileQuery } from '../../../application/queries/get-user-profile.query';
import { ListUsersQuery } from '../../../application/queries/list-users.query';
import { CreateUser } from '../../../domain/services/user-create';
import { RegisterUserCommand } from '../../../application/commands/register-user.command';
import { UpdateUserProfileCommand } from '../../../application/commands/update-user-profile.command';
import { ToggleSystemAdminCommand } from '../../../application/commands/toggle-system-admin.command';
import { ToggleUserActiveCommand } from '../../../application/commands/toggle-user-active.command';
import { UpdateUserProfile } from '../../../domain/services/user-update-profile';
import { ToggleSystemAdmin } from '../../../domain/services/user-toggle-system-admin';
import { ToggleUserActive } from '../../../domain/services/user-toggle-active';
import { ChangePassword } from '../../../domain/services/user-change-password';
import { ChangePasswordCommand } from '../../../application/commands/change-password.command';
import { TypeOrmUserRepository } from '../../typeorm/repositories/typeorm-user.repository';
import { RegisterUserRequest } from '../dto/register-user.request';

@Controller('users')
export class UserController {
  constructor(
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
  ) {}

  @SkipEmailVerification()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    const query = new GetUserProfileQuery(this.userRepository);
    return query.execute({ userId: user.userId });
  }

  @Patch('me/name')
  updateName(
    @Body() body: { firstName: string; lastName: string },
    @CurrentUser() authUser: AuthUser,
  ) {
    const service = new UpdateUserProfile(this.userRepository);
    const command = new UpdateUserProfileCommand(service);
    return command.execute({
      userId: authUser.userId,
      firstName: body.firstName,
      lastName: body.lastName,
    });
  }

  @SkipEmailVerification()
  @Patch('me/language')
  updateLanguage(
    @Body() body: { language: string },
    @CurrentUser() authUser: AuthUser,
  ) {
    const service = new UpdateUserProfile(this.userRepository);
    const command = new UpdateUserProfileCommand(service);
    return command.execute({
      userId: authUser.userId,
      language: body.language,
    });
  }

  @SkipEmailVerification()
  @Patch('me/theme')
  updateTheme(
    @Body() body: { theme: string },
    @CurrentUser() authUser: AuthUser,
  ) {
    const service = new UpdateUserProfile(this.userRepository);
    const command = new UpdateUserProfileCommand(service);
    return command.execute({
      userId: authUser.userId,
      theme: body.theme,
    });
  }

  @Patch('me/password')
  changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @CurrentUser() authUser: AuthUser,
  ) {
    const service = new ChangePassword(this.userRepository, this.passwordHasher);
    const command = new ChangePasswordCommand(service);
    return command.execute({
      userId: authUser.userId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
  }

  @Get()
  list() {
    const query = new ListUsersQuery(this.userRepository);
    return query.execute();
  }

  @Post()
  create(
    @Body() body: RegisterUserRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const service = new CreateUser(this.idGenerator, this.userRepository, this.passwordHasher);
    const command = new RegisterUserCommand(service);
    return command.execute({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      isSystemAdmin: body.isSystemAdmin,
      requestingUserIsAdmin: user.isSystemAdmin,
    });
  }

  @Patch(':id/system-admin')
  toggleSystemAdmin(
    @Param('id') id: string,
    @Body() body: { isSystemAdmin: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    const service = new ToggleSystemAdmin(this.userRepository);
    const command = new ToggleSystemAdminCommand(service);
    return command.execute({
      targetUserId: id,
      isSystemAdmin: body.isSystemAdmin,
      requestingUserIsAdmin: user.isSystemAdmin,
    });
  }

  @Patch(':id/active')
  toggleActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    const service = new ToggleUserActive(this.userRepository);
    const command = new ToggleUserActiveCommand(service);
    return command.execute({
      targetUserId: id,
      isActive: body.isActive,
      requestingUserIsAdmin: user.isSystemAdmin,
    });
  }
}
