import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { TypeOrmAccountRepository } from '../../../../account/infrastructure/typeorm/repositories/typeorm-account.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { CreateAccountForUser } from '../../../../account/domain/services/account-create-for-user';
import { RegisterUserRequest } from '../dto/register-user.request';
import { SortDto } from '../../../../shared/nest/dto/sort.dto';

@Controller('users')
export class UserController {
  constructor(
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly accountRepository: TypeOrmAccountRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @SkipEmailVerification()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    const query = new GetUserProfileQuery(this.userRepository);
    return query.execute({ userId: user.userId });
  }

  @Patch('me/name')
  async updateName(
    @Body() body: { firstName: string; lastName: string },
    @CurrentUser() authUser: AuthUser,
  ) {
    const existing = await this.userRepository.findById(authUser.userId);
    const service = new UpdateUserProfile(this.userRepository);
    const command = new UpdateUserProfileCommand(service);
    const result = await command.execute({
      userId: authUser.userId,
      firstName: body.firstName,
      lastName: body.lastName,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.USER_NAME_UPDATED,
      entityType: 'user',
      entityId: authUser.userId,
      userId: authUser.userId,
      workspaceId: null,
      metadata: {
        before: { firstName: existing?.firstName, lastName: existing?.lastName },
        after: { firstName: body.firstName, lastName: body.lastName },
      },
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @SkipEmailVerification()
  @Patch('me/language')
  async updateLanguage(
    @Body() body: { language: string },
    @CurrentUser() authUser: AuthUser,
  ) {
    const existing = await this.userRepository.findById(authUser.userId);
    const service = new UpdateUserProfile(this.userRepository);
    const command = new UpdateUserProfileCommand(service);
    const result = await command.execute({
      userId: authUser.userId,
      language: body.language,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.USER_LANGUAGE_CHANGED,
      entityType: 'user',
      entityId: authUser.userId,
      userId: authUser.userId,
      workspaceId: null,
      metadata: { before: existing?.language, after: body.language },
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @SkipEmailVerification()
  @Patch('me/theme')
  async updateTheme(
    @Body() body: { theme: string },
    @CurrentUser() authUser: AuthUser,
  ) {
    const existing = await this.userRepository.findById(authUser.userId);
    const service = new UpdateUserProfile(this.userRepository);
    const command = new UpdateUserProfileCommand(service);
    const result = await command.execute({
      userId: authUser.userId,
      theme: body.theme,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.USER_THEME_CHANGED,
      entityType: 'user',
      entityId: authUser.userId,
      userId: authUser.userId,
      workspaceId: null,
      metadata: { before: existing?.theme, after: body.theme },
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @SkipEmailVerification()
  @Patch('me/date-format')
  async updateDateFormat(
    @Body() body: { dateFormat: string },
    @CurrentUser() authUser: AuthUser,
  ) {
    const validFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
    if (!validFormats.includes(body.dateFormat)) {
      throw new Error('Invalid date format');
    }

    const existing = await this.userRepository.findById(authUser.userId);
    const service = new UpdateUserProfile(this.userRepository);
    const command = new UpdateUserProfileCommand(service);
    const result = await command.execute({
      userId: authUser.userId,
      dateFormat: body.dateFormat,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.USER_DATE_FORMAT_CHANGED,
      entityType: 'user',
      entityId: authUser.userId,
      userId: authUser.userId,
      workspaceId: null,
      metadata: { before: existing?.dateFormat, after: body.dateFormat },
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @SkipEmailVerification()
  @Patch('me/timezone')
  async updateTimezone(
    @Body() body: { timezone: string },
    @CurrentUser() authUser: AuthUser,
  ) {
    const existing = await this.userRepository.findById(authUser.userId);
    const service = new UpdateUserProfile(this.userRepository);
    const command = new UpdateUserProfileCommand(service);
    const result = await command.execute({
      userId: authUser.userId,
      timezone: body.timezone,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.USER_TIMEZONE_CHANGED,
      entityType: 'user',
      entityId: authUser.userId,
      userId: authUser.userId,
      workspaceId: null,
      metadata: { before: existing?.timezone, after: body.timezone },
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Patch('me/password')
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @CurrentUser() authUser: AuthUser,
  ) {
    const service = new ChangePassword(this.userRepository, this.passwordHasher);
    const command = new ChangePasswordCommand(service);
    const result = await command.execute({
      userId: authUser.userId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.USER_PASSWORD_CHANGED,
      entityType: 'user',
      entityId: authUser.userId,
      userId: authUser.userId,
      workspaceId: null,
      metadata: null,
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Get()
  list(@Query() sort: SortDto) {
    const query = new ListUsersQuery(this.userRepository);
    return query.execute({ sort });
  }

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post()
  async create(
    @Body() body: RegisterUserRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const service = new CreateUser(this.idGenerator, this.userRepository, this.passwordHasher);
    const command = new RegisterUserCommand(service);
    const result = await command.execute({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      isSystemAdmin: body.isSystemAdmin,
      isEmailVerified: body.isEmailVerified,
      requestingUserIsAdmin: user.isSystemAdmin,
    });

    const createAccount = new CreateAccountForUser(this.idGenerator, this.accountRepository);
    await createAccount.execute({ userId: result.id, firstName: body.firstName });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.USER_CREATED,
      entityType: 'user',
      entityId: result.id,
      userId: user.userId,
      workspaceId: null,
      metadata: { email: body.email },
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Patch(':id/name')
  async updateUserName(
    @Param('id') id: string,
    @Body() body: { firstName: string; lastName: string },
    @CurrentUser() authUser: AuthUser,
  ) {
    if (!authUser.isSystemAdmin) {
      throw new Error('Only system admins can edit user names');
    }

    const existing = await this.userRepository.findById(id);
    if (!existing) throw new Error('User not found');

    const service = new UpdateUserProfile(this.userRepository);
    const command = new UpdateUserProfileCommand(service);
    const result = await command.execute({
      userId: id,
      firstName: body.firstName,
      lastName: body.lastName,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.USER_NAME_UPDATED,
      entityType: 'user',
      entityId: id,
      userId: authUser.userId,
      workspaceId: null,
      metadata: {
        before: { firstName: existing.firstName, lastName: existing.lastName },
        after: { firstName: body.firstName, lastName: body.lastName },
      },
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Patch(':id/system-admin')
  toggleSystemAdmin(
    @Param('id') id: string,
    @Body() body: { isSystemAdmin: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    const service = new ToggleSystemAdmin(this.userRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new ToggleSystemAdminCommand(service, auditLog);
    return command.execute({
      targetUserId: id,
      isSystemAdmin: body.isSystemAdmin,
      requestingUserIsAdmin: user.isSystemAdmin,
      requestingUserId: user.userId,
    });
  }

  @Patch(':id/active')
  toggleActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    const service = new ToggleUserActive(this.userRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new ToggleUserActiveCommand(service, auditLog);
    return command.execute({
      targetUserId: id,
      isActive: body.isActive,
      requestingUserIsAdmin: user.isSystemAdmin,
      requestingUserId: user.userId,
    });
  }
}
