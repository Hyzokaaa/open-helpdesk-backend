import { Body, Controller, Inject, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { AuthenticateUser } from '../../../domain/services/user-authenticate';
import { LoginUserCommand } from '../../../application/commands/login-user.command';
import { TypeOrmUserRepository } from '../../typeorm/repositories/typeorm-user.repository';
import { LoginUserRequest } from '../dto/login-user.request';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly jwtService: JwtService,
  ) {}

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
