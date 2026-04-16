import { Body, Controller, Inject, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { CreateUser } from '../../../domain/services/user-create';
import { AuthenticateUser } from '../../../domain/services/user-authenticate';
import { RegisterUserCommand } from '../../../application/commands/register-user.command';
import { LoginUserCommand } from '../../../application/commands/login-user.command';
import { TypeOrmUserRepository } from '../../typeorm/repositories/typeorm-user.repository';
import { RegisterUserRequest } from '../dto/register-user.request';
import { LoginUserRequest } from '../dto/login-user.request';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  register(@Body() body: RegisterUserRequest) {
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
    });
  }

  @Post('login')
  login(@Body() body: LoginUserRequest) {
    const service = new AuthenticateUser(
      this.userRepository,
      this.passwordHasher,
    );
    const command = new LoginUserCommand(service, this.jwtService);
    return command.execute({
      email: body.email,
      password: body.password,
    });
  }
}
