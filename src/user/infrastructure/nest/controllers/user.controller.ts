import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/nest/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { GetUserProfileQuery } from '../../../application/queries/get-user-profile.query';
import { CreateUser } from '../../../domain/services/user-create';
import { RegisterUserCommand } from '../../../application/commands/register-user.command';
import { TypeOrmUserRepository } from '../../typeorm/repositories/typeorm-user.repository';
import { RegisterUserRequest } from '../dto/register-user.request';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    const query = new GetUserProfileQuery(this.userRepository);
    return query.execute({ userId: user.userId });
  }

  @Get()
  async list() {
    const users = await this.userRepository.findAll();
    return users.map((u) => ({
      id: u.getId(),
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isSystemAdmin: u.isSystemAdmin,
    }));
  }

  @Post()
  create(
    @Body() body: RegisterUserRequest,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.isSystemAdmin) {
      throw new ForbiddenException('Only system admins can create users');
    }

    const service = new CreateUser(
      this.idGenerator,
      this.userRepository,
      this.passwordHasher,
    );
    const command = new RegisterUserCommand(service);
    return command.execute({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      isSystemAdmin: body.isSystemAdmin,
    });
  }

  @Patch(':id/system-admin')
  async toggleSystemAdmin(
    @Param('id') id: string,
    @Body() body: { isSystemAdmin: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.isSystemAdmin) {
      throw new ForbiddenException('Only system admins can manage system admin roles');
    }

    const target = await this.userRepository.findById(id);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    target.isSystemAdmin = body.isSystemAdmin;
    await this.userRepository.update(target);

    return { id: target.getId(), isSystemAdmin: target.isSystemAdmin };
  }
}
