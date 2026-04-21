import { Body, Controller, Inject, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { EmailService } from '../../../../email/domain/email.service';
import { EMAIL_SERVICE } from '../../../../email/email.constants';
import { AuthenticateUser } from '../../../domain/services/user-authenticate';
import { RequestPasswordReset } from '../../../domain/services/user-request-password-reset';
import { ResetPassword } from '../../../domain/services/user-reset-password';
import { LoginUserCommand } from '../../../application/commands/login-user.command';
import { RequestPasswordResetCommand } from '../../../application/commands/request-password-reset.command';
import { ResetPasswordCommand } from '../../../application/commands/reset-password.command';
import { TypeOrmUserRepository } from '../../typeorm/repositories/typeorm-user.repository';
import { LoginUserRequest } from '../dto/login-user.request';

@Controller('auth')
export class AuthController {
  private readonly frontendUrl: string;

  constructor(
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly jwtService: JwtService,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @Post('login')
  login(@Body() body: LoginUserRequest) {
    const service = new AuthenticateUser(this.userRepository, this.passwordHasher);
    const command = new LoginUserCommand(service, this.jwtService);
    return command.execute({
      email: body.email,
      password: body.password,
    });
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    const service = new RequestPasswordReset(this.userRepository);
    const command = new RequestPasswordResetCommand(service, this.jwtService, this.emailService);
    await command.execute({ email: body.email, frontendUrl: this.frontendUrl });
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    const service = new ResetPassword(this.userRepository, this.passwordHasher);
    const command = new ResetPasswordCommand(service, this.jwtService);
    await command.execute({ token: body.token, newPassword: body.newPassword });
    return { message: 'Password has been reset' };
  }
}
