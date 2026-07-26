import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { SkipEmailVerification } from '../../../../shared/nest/decorators/skip-email-verification.decorator';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { JwtTokenService } from '../../../../shared/infrastructure/jwt-token-service';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EmailService } from '../../../../email/domain/email.service';
import { EMAIL_SERVICE } from '../../../../email/email.constants';
import { AuthenticateUser } from '../../../domain/services/user-authenticate';
import { AuthenticateOAuth } from '../../../domain/services/user-authenticate-oauth';
import { RequestPasswordReset } from '../../../domain/services/user-request-password-reset';
import { ResetPassword } from '../../../domain/services/user-reset-password';
import { VerifyEmail } from '../../../domain/services/user-verify-email';
import { LoginUserCommand } from '../../../application/commands/login-user.command';
import { OAuthLoginCommand } from '../../../application/commands/oauth-login.command';
import { RequestPasswordResetCommand } from '../../../application/commands/request-password-reset.command';
import { ResetPasswordCommand } from '../../../application/commands/reset-password.command';
import { VerifyEmailCommand } from '../../../application/commands/verify-email.command';
import { ResendVerificationCommand } from '../../../application/commands/resend-verification.command';
import { TypeOrmUserRepository } from '../../typeorm/repositories/typeorm-user.repository';
import { LoginUserRequest } from '../dto/login-user.request';
import { GoogleAuthGuard } from '../../../../shared/nest/guards/google-auth.guard';
import { MicrosoftAuthGuard } from '../../../../shared/nest/guards/microsoft-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly frontendUrl: string;
  private readonly allowedFrontendUrls: string[];
  private readonly googleEnabled: boolean;
  private readonly microsoftEnabled: boolean;

  constructor(
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly tokenService: JwtTokenService,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {
    const rawFrontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
    this.allowedFrontendUrls = rawFrontendUrl.split(',').map((u: string) => u.trim());
    this.frontendUrl = this.allowedFrontendUrls[0];
    this.googleEnabled = !!config.get('GOOGLE_CLIENT_ID');
    this.microsoftEnabled = !!config.get('MICROSOFT_CLIENT_ID');
  }

  @Public()
  @Get('providers')
  getProviders() {
    return {
      google: this.googleEnabled,
      microsoft: this.microsoftEnabled,
    };
  }

  @Public()
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

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    const service = new RequestPasswordReset(this.userRepository);
    const command = new RequestPasswordResetCommand(service, this.tokenService, this.emailService);
    await command.execute({ email: body.email, frontendUrl: this.frontendUrl });
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    const service = new ResetPassword(this.userRepository, this.passwordHasher);
    const command = new ResetPasswordCommand(service, this.tokenService);
    await command.execute({ token: body.token, newPassword: body.newPassword });
    return { message: 'Password has been reset' };
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() body: { token: string }) {
    const service = new VerifyEmail(this.userRepository);
    const command = new VerifyEmailCommand(service, this.tokenService);
    await command.execute({ token: body.token });
    return { message: 'Email verified' };
  }

  @SkipEmailVerification()
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

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Guard redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleOAuthCallback(req, res);
  }

  @Public()
  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  microsoftLogin() {
    // Guard redirects to Microsoft
  }

  @Public()
  @Get('microsoft/callback')
  @UseGuards(MicrosoftAuthGuard)
  async microsoftCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleOAuthCallback(req, res);
  }

  private async handleOAuthCallback(req: Request, res: Response) {
    const oauthUser = req.user as { email: string; firstName: string; lastName: string; authProvider: string };
    const redirectUrl = this.resolveRedirectUrl(req.query?.state as string);

    try {
      const service = new AuthenticateOAuth(this.idGenerator, this.userRepository, this.passwordHasher);
      const command = new OAuthLoginCommand(service, this.tokenService);
      const result = await command.execute({
        email: oauthUser.email,
        firstName: oauthUser.firstName,
        lastName: oauthUser.lastName,
        authProvider: oauthUser.authProvider,
      });

      return res.redirect(`${redirectUrl}/auth/callback?token=${result.accessToken}`);
    } catch {
      return res.redirect(`${redirectUrl}/login?error=oauth_failed`);
    }
  }

  private resolveRedirectUrl(state?: string): string {
    if (state && this.allowedFrontendUrls.includes(state)) {
      return state;
    }
    return this.frontendUrl;
  }
}
