import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { SkipEmailVerification } from '../../../../shared/nest/decorators/skip-email-verification.decorator';
import { JwtAuthGuard } from '../../../../shared/nest/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { JwtTokenService } from '../../../../shared/infrastructure/jwt-token-service';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { EmailService } from '../../../../email/domain/email.service';
import { EMAIL_SERVICE } from '../../../../email/email.constants';
import { AuthenticateUser } from '../../../domain/services/user-authenticate';
import { RequestPasswordReset } from '../../../domain/services/user-request-password-reset';
import { ResetPassword } from '../../../domain/services/user-reset-password';
import { VerifyEmail } from '../../../domain/services/user-verify-email';
import { LoginUserCommand } from '../../../application/commands/login-user.command';
import { RequestPasswordResetCommand } from '../../../application/commands/request-password-reset.command';
import { ResetPasswordCommand } from '../../../application/commands/reset-password.command';
import { VerifyEmailCommand } from '../../../application/commands/verify-email.command';
import { ResendVerificationCommand } from '../../../application/commands/resend-verification.command';
import { TypeOrmUserRepository } from '../../typeorm/repositories/typeorm-user.repository';
import { LoginUserRequest } from '../dto/login-user.request';

@Public()
@Controller('auth')
export class AuthController {
  private readonly frontendUrl: string;

  constructor(
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly tokenService: JwtTokenService,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  login(@Body() body: LoginUserRequest) {
    const service = new AuthenticateUser(this.userRepository, this.passwordHasher);
    const command = new LoginUserCommand(service, this.tokenService);
    return command.execute({
      email: body.email,
      password: body.password,
    });
  }

  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    const service = new RequestPasswordReset(this.userRepository);
    const command = new RequestPasswordResetCommand(service, this.tokenService, this.emailService);
    await command.execute({ email: body.email, frontendUrl: this.frontendUrl });
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    const service = new ResetPassword(this.userRepository, this.passwordHasher);
    const command = new ResetPasswordCommand(service, this.tokenService);
    await command.execute({ token: body.token, newPassword: body.newPassword });
    return { message: 'Password has been reset' };
  }

  @Post('verify-email')
  async verifyEmail(@Body() body: { token: string }) {
    const service = new VerifyEmail(this.userRepository);
    const command = new VerifyEmailCommand(service, this.tokenService);
    await command.execute({ token: body.token });
    return { message: 'Email verified' };
  }

  @SkipEmailVerification()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  @Post('resend-verification')
  async resendVerification(@CurrentUser() user: AuthUser) {
    const command = new ResendVerificationCommand(
      this.userRepository,
      this.tokenService,
      this.emailService,
    );
    await command.execute({ userId: user.userId, frontendUrl: this.frontendUrl });
    return { message: 'Verification email sent' };
  }
}
